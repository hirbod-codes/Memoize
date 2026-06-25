import express from 'express';
import { string, ValidationError } from 'yup';
import { auth, authorization } from '../middlewares/auth';
import { BUCKET_NAME, s3 } from '..';
import { Upload } from "@aws-sdk/lib-storage";
import ImageRepository from '../DB/repositories/ImageRepository';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const router = express.Router();

router.post('/', auth, authorization, async (req, res) => {
    try {
        console.log('/api/image', 'POST')

        console.log('Validating...')
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

        const userId = (req as any).user.userId

        const imageRepository = new ImageRepository()

        console.log("Checking weather title already exists...");
        const image = await imageRepository.getForUserByTitle(title, userId);
        if (image)
            return res.status(400).json({ message: 'Image title must be unique.' });

        const imageFileBucketKey = `image/${userId}/${title}`

        console.log("Inserting image...");
        const imageInsertResult = await imageRepository.insert({ title, fileName, contentType: "image/jpg", userId, bucketKey: imageFileBucketKey, temporary: true })
        console.log("Image insert result", imageInsertResult);
        if (!imageInsertResult.acknowledged || !imageInsertResult.insertedId)
            return res.status(500).json({ ok: false, message: 'Image info creation failed' })

        let uploadImage: Upload | null = null

        try {
            console.log("Uploading image file...");
            uploadImage = new Upload({
                client: s3,
                params: {
                    Bucket: BUCKET_NAME,
                    Key: imageFileBucketKey,
                    Body: req
                }
            });
            await uploadImage.done();
        } catch (err) {
            console.error(err);

            try {
                await uploadImage?.abort();
            } catch (abortErr) { console.error('Failed to abort segment/playlist uploads:', abortErr); }

            return res.status(500).json({ message: 'Error uploading video file' });
        } finally {
            console.log('------------end------------');
        }

        const r = await imageRepository.unsafeUpdate(imageInsertResult.insertedId.toString(), userId, { contentType: req.headers['content-type'] ?? "image/jpg", temporary: false })
        if (!r.acknowledged || r.matchedCount !== 1) {
            await uploadImage.abort();
            return res.status(500).json({ ok: false, message: 'Image info update failed' });
        }

        res.status(201).json({ id: imageInsertResult });
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
            imageId = await string().objectIdString().optional().label('Image id').validate(req.query.imageId?.toString())
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

        const userId = (req as any).user.userId

        const imageRepository = new ImageRepository()

        let result
        if (imageId)
            result = await imageRepository.getForUser(imageId, userId)
        else
            result = await imageRepository.getForUserByTitle(title!, userId)

        console.log({ result })

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

        const userId = (req as any).user.userId

        const imageRepository = new ImageRepository()

        console.log("Checking weather image exists...");
        const image = await imageRepository.getForUser(imageId, userId)
        if (!image) {
            res.status(404).json({ message: 'Image not found' });
            return
        }
        console.log({ image })

        const result = await s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: image.bucketKey,
            ResponseContentDisposition: download ? `attachment; filename="${image.fileName}"` : undefined,
        }));

        const stream = result.Body;
        if (stream === undefined || stream === null)
            return res.status(404).send();

        const contentLength = result.ContentLength;

        res.setHeader("Content-Type", result.ContentType || "image/jpg");

        res.status(200);
        res.setHeader("Content-Length", contentLength ?? "");

        (stream as any).pipe(res);
    } catch (err) {
        res.status(500).json({ message: 'Error getting image file' });
    } finally {
        console.log('------------end------------')
    }
});

router.delete('/:imageId', auth, authorization, async (req, res) => {
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

        const userId = (req as any).user.userId

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