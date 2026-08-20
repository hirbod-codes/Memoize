import express from 'express';
import { string, ValidationError } from 'yup';
import { auth } from '../middlewares/auth';
import { BUCKET_NAME, imageUploadTmpDir } from '../configs';
import { Upload } from "@aws-sdk/lib-storage";
import ImageRepository from '../DB/repositories/ImageRepository';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { fileTypeFromBuffer } from 'file-type';
import { teeStream } from '../lib/stream';
import { MaxFileSizeExceededError } from '../errors/MaxFileSizeExceededError';
import { MinFileSizeNotMetError } from '../errors/MinFileSizeNotMetError';
import { s3 } from '..';
import { authorizeFeature, authorizeQuota } from '../middlewares/authorization';
import { basename, join } from 'path';
import { mkdir, rm, unlink } from 'fs/promises';
import { deleteFromS3, detectContentType, receiveUpload, uploadToS3 } from '../lib/file_management';
import { UsageField } from '../DB/models/Usage';
import { UploadTooLargeError } from '../errors/UploadTooLargeError';
import { createReadStream } from 'fs';
import { InvalidMediaError } from '../errors/InvalidMediaError';
import { Readable } from 'stream';

const router = express.Router();

router.post('/', auth, authorizeFeature(['allowedContentTypes.image']), authorizeQuota(new Map([['valuePerContentCount.image', 1]])), async (req, res) => {
    try {
        console.log('/api/image', 'POST')

        console.log('Validating...');
        // ------------------------------------------------------------------------- Validating...
        let fileName: string | undefined, title: string | undefined
        try {
            title = await string().required().label('Title').validate(req.query.title?.toString())
            fileName = await string().required().label('File name').validate(req.query.fileName?.toString())
            console.log({ title, fileName })
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Image info.' });
        }

        const userId = req.user!.userId

        const imageRepository = new ImageRepository()

        console.log("Checking weather title already exists...");
        // ------------------------------------------------------------------------- Checking weather title already exists...
        const image = await imageRepository.getForUserByTitle(title, userId);
        if (image)
            return res.status(400).json({ message: 'Image title must be unique.' });

        console.log("Inserting image...");
        // ------------------------------------------------------------------------- Inserting image...
        const imageInsertResult = await imageRepository.insert({ title, userId, temporary: true })
        console.log("Image insert result", imageInsertResult);
        if (!imageInsertResult.acknowledged || !imageInsertResult.insertedId)
            return res.status(500).json({ ok: false, message: 'Image info creation failed' })
        const imageId = imageInsertResult.insertedId.toString()

        // ------------------------------------------------------------------------- Make the temporary directory
        const jobDir = join(imageUploadTmpDir, imageId)
        await mkdir(jobDir, { recursive: true });

        const cleanupPaths: string[] = [];
        const cleanup = async () => {
            await Promise.all(cleanupPaths.map((p) => unlink(p).catch(() => { })));
            await rm(jobDir, { recursive: true, force: true }).catch(() => { });
        };

        let rollbackPromises: undefined | Promise<any> = undefined
        try {
            const maxTotalStorageBytes = req.user!.privileges!.maxStorageBytes;

            // ------------------------------------------------------------------------- Store upload stream on disk
            const { path: inputPath, size: inputSize } = await receiveUpload(req, maxTotalStorageBytes, jobDir);
            cleanupPaths.push(inputPath);

            // ------------------------------------------------------------------------- Set bucket keys
            const imageFileBucketKey = `image/${userId}/${imageId}`

            // ------------------------------------------------------------------------- Wait for content type to be collected
            const contentType = await detectContentType(inputPath)

            // ------------------------------------------------------------------------- Validate generated file sizes
            const totalStorageBytes = inputSize
            const quota = new Map<UsageField, number>([['storageBytesCount', totalStorageBytes]])
            if (await authorizeQuota(quota, req) !== true)
                throw new UploadTooLargeError('Generated files exceed plan storage limit');

            try {
                // ------------------------------------------------------------------------- Upload files to the S3 compatible object storage
                await uploadToS3(createReadStream(inputPath), imageFileBucketKey, contentType.mimeType)

                // ------------------------------------------------------------------------- Update image info in DB, Make it permanent and set content type
                const updateResult = await imageRepository.unsafeUpdate(imageId, userId, { contentType: contentType, temporary: false, bucketKey: imageFileBucketKey });
                if (!updateResult.acknowledged || updateResult.matchedCount !== 1)
                    throw new Error('failed to upload image')

                // Work is durably done — clear reservations so the response-based rollback middleware becomes a no-op for this request no matter what happens to the connection from here on.
                // The connection might drop at this exact moment, which fires the res.on('close') and causes rollbackQuotaOnFailure middleware to rollback although content is properly uploaded and stored(a false alarm).
                req.quotaReservations = []
            } catch (error) {
                rollbackPromises = Promise.allSettled([
                    deleteFromS3(imageFileBucketKey).catch((_) => { }),
                    imageRepository.delete(imageId).catch((_) => { })
                ])

                throw error
            }
        } catch (err) {
            if (err instanceof UploadTooLargeError) {
                res.status(403).json({ error: err.message });
            } else if (err instanceof InvalidMediaError) {
                res.status(400).json({ error: err.message });
            } else {
                console.error('Video upload failed:', err);
                res.status(500).json({ error: 'Upload failed' });
            }
        } finally {
            await cleanup();
            if (rollbackPromises !== undefined) await rollbackPromises
        }

        res.status(201).json({ id: imageId });
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Error uploading video file' });
    } finally {
        console.log('------------end------------');
    }
})

router.get('/info/', auth, async (req, res) => {
    try {
        console.log('/api/image/info')

        console.log('Validation...')
        let imageId: string | undefined = undefined
        let title: string | undefined = undefined
        try {
            imageId = await string().objectIdString().optional().label('Image id').validate(req.query.id?.toString())
            title = await string().optional().label('Title').validate(req.query.title?.toString())

            if (imageId === undefined && title === undefined) {
                res.status(400).json({ message: 'Invalid parameters' });
                return
            }
        } catch (err) {
            console.error(err)
            res.status(400).json({ message: 'Invalid parameters' });
            return
        }
        console.log({ imageId, title })

        const userId = req.user!.userId

        const imageRepository = new ImageRepository()

        let result
        if (imageId)
            result = await imageRepository.getForUser(imageId, userId)
        else
            result = await imageRepository.getForUserByTitle(title!, userId)
        console.log({ result })
        if (!result)
            return res.status(404).send()

        res.status(200).json(result)

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting image' });
    }
});

router.get('/file/:imageId', auth, async (req, res) => {
    try {
        console.log('/api/image/file')

        console.log('Validation...')
        let imageId: string | undefined = undefined, download: boolean = false
        try {
            imageId = await string().objectIdString().required().label('Image id').validate(req.params.imageId?.toString())
            let temp = await string().optional().label('Download').validate(req.query.download?.toString())
            download = temp === 'true';
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        console.log({ imageId })

        const userId = req.user!.userId

        const imageRepository = new ImageRepository()

        console.log("Checking weather image exists...");
        const image = await imageRepository.getForUser(imageId, userId)
        if (!image || !image.bucketKey || !image.contentType)
            return res.status(404).json({ message: 'Image not found' });
        console.log({ image })

        const result = await s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: image.bucketKey,
            ResponseContentDisposition: download ? `attachment; filename="${image._id!.toString()}.${image.contentType.extension}"` : undefined,
        }));

        const body = result.Body as Readable;
        body.on('error', (err) => {
            console.error('S3 stream error:', err);
            if (!res.headersSent) res.status(500).end();
            else res.destroy();
        });

        res.status(200);
        res.setHeader('Content-Type', image.contentType.mimeType);
        if (result.ContentRange) res.setHeader('Content-Range', result.ContentRange);
        if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength);

        body.pipe(res);
    } catch (err) {
        res.status(500).json({ message: 'Error getting image file' });
    } finally {
        console.log('------------end------------')
    }
});

router.delete('/:imageId', auth, async (req, res) => {
    try {
        console.log('/api/image', 'DELETE')

        console.log('Validation...')
        let imageId: string | undefined = undefined
        try {
            imageId = await string().objectIdString().required().label('Image id').validate(req.params.imageId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ imageId })

        const userId = req.user!.userId

        const imageRepository = new ImageRepository()

        console.log("Checking weather image exists...");
        const image = await imageRepository.getForUser(imageId, userId)
        if (!image) {
            res.status(404).json({ message: 'Image not found' });
            return
        }
        console.log({ image })

        console.log("Make image temporary in DB to maintain consistency...");
        const r = await imageRepository.unsafeUpdate(imageId, userId, { temporary: true })
        if (!r.acknowledged || r.matchedCount)
            return res.status(500).send()

        console.log("Deleting image file in the bucket storage...");
        await s3.send(
            new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: image.bucketKey
            })
        );

        console.log("Deleting image in DB...");
        const rr = await imageRepository.delete(imageId)
        if (!rr.acknowledged)
            return res.status(500).send()

        res.status(200).send();
    } catch (err) {
        res.status(500).json({ message: 'Error deleting image' });
    } finally {
        console.log('------------end------------')
    }
});

export { router as imageRoutes };