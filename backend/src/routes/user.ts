import express from 'express';
import { string, ValidationError } from 'yup';
import { generalRateLimiter } from '../middlewares/rateLimiting';
import { UserRepository } from '../DB/repositories/UserRepository';
import { auth } from '../middlewares/auth';
import { Upload } from '@aws-sdk/lib-storage';
import { BUCKET_NAME, s3 } from '..';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const router = express.Router();

router.use(auth, generalRateLimiter)

router.get('/info', async (req, res) => {
    try {
        console.log('/api/user')

        console.log('Fetching...')
        const userRepository = new UserRepository()
        const result = await userRepository.get((req as any).user.userId)
        if (result === false) {
            res.status(401).send()
            return
        }

        res.status(200).json(result)

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

router.post('/avatar', async (req, res) => {
    try {
        console.log('/api/user/avatar')

        console.log('Validations...')
        let fileName: string | undefined
        try {
            fileName = req.query.name?.toString()
            console.log('fileName', fileName)
            if (!string().required().isValidSync(fileName)) {
                res.status(400).json({ message: 'Invalid file name' });
                return
            }
        } catch (err) {
            console.error(err)
            res.status(400).json({ message: 'Invalid file' });
            return
        }

        const userId = (req as any).user.userId

        const avatarKey = `user/avatar/${userId}`

        const userRepository = new UserRepository()

        const userUnsafeUpdate = await userRepository.unsafeUpdate(userId, { avatarKey, temporaryAvatar: true })
        if (!userUnsafeUpdate.acknowledged || userUnsafeUpdate.matchedCount !== 1)
            return res.status(500).json({ ok: false, message: 'User avatar update failed' });

        let uploadImage: Upload | null = null

        try {
            console.log("Uploading avatar file...");
            uploadImage = new Upload({
                client: s3,
                params: {
                    Bucket: BUCKET_NAME,
                    Key: avatarKey,
                    Body: req
                }
            });
            await uploadImage.done();
        } catch (err) {
            console.error(err);

            try {
                await uploadImage?.abort();
            } catch (abortErr) { console.error('Failed to abort avatar:', abortErr); }

            return res.status(500).json({ message: 'Error uploading avatar file' });
        } finally {
            console.log('------------end------------');
        }

        const userUnsafeUpdate2 = await userRepository.unsafeUpdate(userId, { temporaryAvatar: false })
        if (!userUnsafeUpdate2.acknowledged || userUnsafeUpdate2.matchedCount !== 1) {
            await uploadImage.abort();
            return res.status(500).json({ ok: false, message: 'Image info update failed' });
        }

        res.status(201).send()

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

router.get('/avatar', async (req, res) => {
    try {
        console.log('/api/user/avatar')

        console.log('Validation...')
        let download: boolean = false
        try {
            let temp = await string().optional().label('Download').validate(req.query.download?.toString())
            download = temp === 'true';
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid parameters' });
        }

        const userId = (req as any).user.userId

        const userRepository = new UserRepository()

        console.log("Fetch user info...");
        const user = await userRepository.get(userId)
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        if (!user.avatarKey || user.temporaryAvatar)
            return res.status(404).json({ message: 'Avatar not found' });
        console.log({ user })

        const s3Result = await s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: user.avatarKey,
            ResponseContentDisposition: download ? `attachment; filename="user_avatar.jpg"` : undefined,
        }));

        const stream = s3Result.Body;
        if (stream === undefined || stream === null)
            return res.status(404).send();

        const contentLength = s3Result.ContentLength;

        res.setHeader("Content-Type", s3Result.ContentType || "image/jpg");

        res.status(200);
        res.setHeader("Content-Length", contentLength ?? "");

        (stream as any).pipe(res);

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

router.delete('/avatar', async (req, res) => {
    try {
        console.log('/api/user/avatar')

        const userId = (req as any).user.userId

        const userRepository = new UserRepository()

        console.log("Fetch user info...");
        const user = await userRepository.get(userId)
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        if (!user.avatarKey || user.temporaryAvatar)
            return res.status(404).json({ message: 'Avatar not found' });
        console.log({ user })

        await s3.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: user.avatarKey,
        }));

        console.log("Deleting image in DB...");
        const rr = await userRepository.unsafeUpdate(userId, { avatarKey: undefined, temporaryAvatar: false })
        if (!rr.acknowledged)
            return res.status(500).send()

        res.status(200).send();
    } catch (err) {
        console.error(err)
        res.status(500).send()
    } finally {
        console.log('------------end------------')
    }
})

export { router as userRoutes };
