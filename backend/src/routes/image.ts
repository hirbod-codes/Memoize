import express from 'express';
import { string, ValidationError } from 'yup';
import { auth } from '../middlewares/auth';
import { BUCKET_NAME, imageUploadTmpDir } from '../configs';
import ImageRepository from '../DB/repositories/ImageRepository';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '..';
import { authorizeFeature, authorizeQuota } from '../middlewares/authorization';
import { join } from 'path';
import { mkdir, rm, unlink } from 'fs/promises';
import { deleteFromS3, detectContentType, receiveUpload, uploadToS3 } from '../lib/file_management';
import { UsageField } from '../DB/models/Usage';
import { UploadTooLargeError } from '../errors/UploadTooLargeError';
import { createReadStream } from 'fs';
import { InvalidMediaError } from '../errors/InvalidMediaError';
import { Readable } from 'stream';
import { getLogger } from '../observability/requestContext';

const router = express.Router();

router.post('/', auth, authorizeFeature(['allowedContentTypes.image']), authorizeQuota(new Map([['valuePerContentCount.image', 1]])), async (req, res) => {
    let reqLog = getLogger().child({ module: 'image', route: 'POST /api/image' });

    try {
        reqLog.debug({ query: req.query }, 'Audio upload request received');

        // ------------------------------------------------------------------------- Validating...
        let fileName: string | undefined, title: string | undefined
        try {
            title = await string().required().label('Title').validate(req.query.title?.toString())
            fileName = await string().required().label('File name').validate(req.query.fileName?.toString())
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected image upload: invalid metadata');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected image upload: invalid metadata');
            return res.status(400).json({ message: 'Invalid Image info.' });
        }
        reqLog.debug({ title, fileName }, 'Validated upload metadata');

        const userId = req.user!.userId
        reqLog = reqLog.child({ userId });

        const imageRepository = new ImageRepository()

        // ------------------------------------------------------------------------- Checking weather title already exists...
        const image = await imageRepository.getForUserByTitle(title, userId);
        reqLog.debug({ titleTaken: !!image }, 'Checked title uniqueness');
        if (image) {
            reqLog.info({ title }, 'Rejected image upload: title already exists');
            return res.status(400).json({ message: 'Image title must be unique.' });
        }

        // ------------------------------------------------------------------------- Inserting image...
        const imageInsertResult = await imageRepository.insert({ title, userId, temporary: true })
        reqLog.debug({ insertResult: imageInsertResult }, 'Inserted temporary image record');
        if (!imageInsertResult.acknowledged || !imageInsertResult.insertedId) {
            reqLog.error({ insertResult: imageInsertResult }, 'Image info creation failed');
            return res.status(500).json({ ok: false, message: 'Image info creation failed' })
        }
        const imageId = imageInsertResult.insertedId.toString()
        reqLog = reqLog.child({ imageId });
        reqLog.info('Created temporary image record');

        // ------------------------------------------------------------------------- Make the temporary directory
        const jobDir = join(imageUploadTmpDir, imageId)
        await mkdir(jobDir, { recursive: true });
        reqLog.debug({ jobDir }, 'Created job scratch directory');

        const cleanupPaths: string[] = [];
        const cleanup = async () => {
            reqLog.debug({ cleanupPaths, jobDir }, 'Cleaning up temp files');
            await Promise.all(cleanupPaths.map((p) => unlink(p).catch(() => { })));
            await rm(jobDir, { recursive: true, force: true }).catch(() => { });
        };

        let rollbackPromises: undefined | Promise<any> = undefined
        try {
            const maxTotalStorageBytes = req.user!.privileges!.maxStorageBytes;
            reqLog.debug({ maxTotalStorageBytes }, 'Resolved plan storage limit');

            // ------------------------------------------------------------------------- Store upload stream on disk
            const { path: inputPath, size: inputSize } = await receiveUpload(req, maxTotalStorageBytes, jobDir);
            cleanupPaths.push(inputPath);
            reqLog.info({ inputSize, inputPath }, 'Upload received and stored to disk');

            // ------------------------------------------------------------------------- Set bucket keys
            const imageFileBucketKey = `image/${userId}/${imageId}`
            reqLog.debug({ imageFileBucketKey }, 'Computed bucket keys');

            // ------------------------------------------------------------------------- Wait for content type to be collected
            const contentType = await detectContentType(inputPath)
            reqLog.debug({ contentType }, 'Detected content type');

            // ------------------------------------------------------------------------- Validate generated file sizes
            const totalStorageBytes = inputSize
            reqLog.debug({ inputSize, totalStorageBytes }, 'Computed total storage footprint');
            const quota = new Map<UsageField, number>([['storageBytesCount', totalStorageBytes]])
            if (await authorizeQuota(quota, req) !== true) {
                reqLog.info({ totalStorageBytes }, 'Rejected image upload: exceeds plan storage limit');
                throw new UploadTooLargeError('Generated files exceed plan storage limit');
            }
            reqLog.debug('Storage quota authorized');

            try {
                // ------------------------------------------------------------------------- Upload files to the S3 compatible object storage
                reqLog.debug('Uploading files to object storage');
                await uploadToS3(createReadStream(inputPath), imageFileBucketKey, contentType.mimeType)
                reqLog.info({ inputPath, imageFileBucketKey, contentType }, 'Uploaded files to object storage');

                // ------------------------------------------------------------------------- Update image info in DB, Make it permanent and set content type
                const updateResult = await imageRepository.unsafeUpdate(imageId, userId, { contentType: contentType, temporary: false, bucketKey: imageFileBucketKey });
                reqLog.debug({ updateResult }, 'Updated image record');
                if (!updateResult.acknowledged || updateResult.matchedCount !== 1)
                    throw new Error('failed to upload image')

                // Work is durably done — clear reservations so the response-based rollback middleware becomes a no-op for this request no matter what happens to the connection from here on.
                // The connection might drop at this exact moment, which fires the res.on('close') and causes rollbackQuotaOnFailure middleware to rollback although content is properly uploaded and stored(a false alarm).
                req.quotaReservations = []
                reqLog.info({ totalStorageBytes }, 'Image upload finalized');
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
                reqLog.error({ err }, 'Audio upload failed');
                res.status(500).json({ error: 'Upload failed' });
            }
        } finally {
            await cleanup();
            if (rollbackPromises !== undefined) {
                await rollbackPromises
                reqLog.debug('Rollback of stored artifacts completed');

            }
        }

        res.status(201).json({ id: imageId });
    } catch (err) {
        reqLog.error({ err }, 'Unhandled error in image upload route');
        return res.status(500).json({ message: 'Error uploading video file' });
    }
})

router.get('/info/', auth, async (req, res) => {
    let reqLog = getLogger().child({ module: 'image', route: 'GET /image/info' });

    try {
        reqLog.debug({ query: req.query }, 'image info request received');

        let imageId: string | undefined = undefined
        let title: string | undefined = undefined
        try {
            imageId = await string().objectIdString().optional().label('Image id').validate(req.query.id?.toString())
            title = await string().optional().label('Title').validate(req.query.title?.toString())

            if (imageId === undefined && title === undefined) {
                reqLog.warn('Rejected image info request: missing id and title');
                return res.status(400).json({ message: 'Invalid parameters' });
            }
        } catch (err) {
            reqLog.warn({ err }, 'Rejected image info request: invalid parameters');
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        reqLog.debug({ title, imageId }, 'Validated metadata');

        const userId = req.user!.userId
        reqLog = reqLog.child({ userId, imageId, title });
        reqLog.debug('Validated lookup parameters');

        const imageRepository = new ImageRepository()

        let result
        if (imageId)
            result = await imageRepository.getForUser(imageId, userId)
        else
            result = await imageRepository.getForUserByTitle(title!, userId)

        if (!result) {
            reqLog.info('Image not found');
            return res.status(404).send()
        } else {
            reqLog.debug({ imageId: result._id?.toString() }, 'Image found');
        }

        res.status(200).json(result)
    } catch (err) {
        reqLog.error({ err }, 'Failed to get image info');
        res.status(500).json({ message: 'Error getting image' });
    }
});

router.get('/file/:imageId', auth, async (req, res) => {
    let reqLog = getLogger().child({ module: 'image', route: 'GET /file/:imageId' });

    try {
        reqLog.debug({ params: req.params, query: req.query }, 'Image file request received');

        let imageId: string | undefined = undefined, download: boolean = false
        try {
            imageId = await string().objectIdString().required().label('Image id').validate(req.params.imageId?.toString())
            let temp = await string().optional().label('Download').validate(req.query.download?.toString())
            download = temp === 'true';
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected image file request: invalid parameters');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected image file request: invalid parameters');
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        reqLog.debug({ imageId, download }, 'Validated metadata');

        const userId = req.user!.userId
        reqLog = reqLog.child({ userId, imageId, download });

        const imageRepository = new ImageRepository()

        const image = await imageRepository.getForUser(imageId, userId)
        if (!image || !image.bucketKey || !image.contentType) {
            reqLog.info({ hasAudio: !!image }, 'Image not found or missing expected bucket key');
            return res.status(404).json({ message: 'Image not found' });
        }
        reqLog.debug({ imageId: image._id?.toString() }, 'Image found');

        const result = await s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: image.bucketKey,
            ResponseContentDisposition: download ? `attachment; filename="${image._id!.toString()}.${image.contentType.extension}"` : undefined,
        }));
        reqLog.debug({ key: image.bucketKey, contentLength: result.ContentLength, contentRange: result.ContentRange }, 'Fetched object from storage');

        if (result.Body === undefined || result.Body === null) {
            reqLog.warn({ key: image.bucketKey }, 'Storage object has no body');
            return res.status(404).send();
        }

        const body = result.Body as Readable;
        body.on('error', (err) => {
            reqLog.error({ err, key: image.bucketKey }, 'S3 stream error while serving image file');
            if (!res.headersSent) res.status(500).end();
            else res.destroy();
        });

        res.status(200);
        res.setHeader('Content-Type', image.contentType.mimeType);
        if (result.ContentRange) res.setHeader('Content-Range', result.ContentRange);
        if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength);

        reqLog.info({ key: image.bucketKey, download, statusCode: 200 }, 'Streaming image file to client');
        body.pipe(res);
    } catch (err) {
        reqLog.error({ err }, 'Failed to stream image file');
        res.status(500).json({ message: 'Error getting image file' });
    }
});

router.delete('/:imageId', auth, async (req, res) => {
    let reqLog = getLogger().child({ module: 'image', route: 'DELETE /image/:audioId' });

    try {
        reqLog.debug({ params: req.params }, 'Image delete request received');

        let imageId: string | undefined = undefined
        try {
            imageId = await string().objectIdString().required().label('Image id').validate(req.params.imageId?.toString())
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected image delete request: invalid parameters');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected image delete request: invalid parameters');
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        reqLog.debug({ imageId }, 'Validated metadata');

        const userId = req.user!.userId
        reqLog = reqLog.child({ userId, imageId });

        const imageRepository = new ImageRepository()

        const image = await imageRepository.getForUser(imageId, userId)
        if (!image) {
            reqLog.info('Image not found');
            return res.status(404).json({ message: 'Image not found' });
        }
        reqLog.debug({ image, bucketKey: image.bucketKey }, 'Image found, starting delete');

        const r = await imageRepository.unsafeUpdate(imageId, userId, { temporary: true })
        reqLog.debug({ updateResult: r }, 'Marked image temporary in DB before delete');
        if (!r.acknowledged || r.matchedCount) {
            reqLog.error({ updateResult: r }, 'Failed to mark image temporary before delete');
            return res.status(500).send()
        }

        await s3.send(
            new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: image.bucketKey
            })
        );
        reqLog.debug({ key: image.bucketKey }, 'Deleted image file from storage');

        const rr = await imageRepository.delete(imageId)
        reqLog.debug({ deleteResult: rr }, 'Deleted image record from DB');
        if (!rr.acknowledged) {
            reqLog.error({ deleteResult: rr }, 'Failed to delete image record from DB');
            return res.status(500).send()
        }

        reqLog.info('Image deleted');
        res.status(200).send();
    } catch (err) {
        reqLog.error({ err }, 'Failed to delete image');
        res.status(500).json({ message: 'Error deleting image' });
    }
});

export { router as imageRoutes };