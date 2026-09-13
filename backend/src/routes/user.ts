import express from 'express';
import { string, ValidationError } from 'yup';
import { generalRateLimiter } from '../middlewares/rateLimiting';
import { UserRepository } from '../DB/repositories/UserRepository';
import { auth } from '../middlewares/auth';
import { Upload } from '@aws-sdk/lib-storage';
import { BUCKET_NAME } from '../configs';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '..';
import { getLogger, runWithLogger } from '../observability/requestLoggerContext';
import { handleError, validate } from '../lib';
import { fetchAvatarSchema, preferencesSchema, uploadAvatarSchema } from './user/schemas';

const router = express.Router();

router.use(auth, generalRateLimiter)

router.get('/info', async (req, res) => {
    try {
        console.log('/api/user')

        console.log('Fetching...')
        const userRepository = new UserRepository()
        const result = await userRepository.get(req.user!.userId)
        if (result === false) {
            res.status(401).send()
            return
        }

        res.status(200).json({ status: 'success', data: result })

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

router.post('/preferences', async (req, res) => {
    const log = getLogger().child({ module: 'user', route: 'POST /api/user/refresh' });

    try {
        log.info('update user preferences request received')

        const { language, calendar, timezone } = await runWithLogger(log, () => validate(preferencesSchema, req.body ?? {}))
        log.debug({ language, calendar, timezone })

        const userId = req.user!.userId
        log.debug({ userId })

        const ur = new UserRepository()

        const updateResult = await runWithLogger(log, () => ur.unsafeUpdate(userId, { language, calendar, timezone }));
        log.debug({ updateResult })
        if (updateResult !== true) {
            log.warn('system failed to update user\'s preferences');
            return res.status(500).json({ status: 'error', error_code: 'UPDATE_FAILED' })
        }

        return res.status(204).json({ status: 'success' })
    } catch (err: any) {
        runWithLogger(log, () => handleError(res, err))
    }
})

router.post('/avatar', async (req, res) => {
    const log = getLogger().child({ module: 'user', route: 'POST /api/user/avatar' });

    try {
        log.info('upload user avatar request received')

        const { fileName } = await runWithLogger(log, () => validate(uploadAvatarSchema, req.query ?? {}))
        log.debug({ fileName })

        const userId = req.user!.userId
        log.debug({ userId })

        const avatarKey = `user/avatar/${userId}`
        log.debug({ avatarKey })

        const userRepository = new UserRepository()

        const userUnsafeUpdate = await runWithLogger(log, () => userRepository.unsafeUpdate(userId, { avatarKey, temporaryAvatar: true }))
        log.debug({ userUnsafeUpdate })
        if (userUnsafeUpdate !== true) {
            log.error('failure while trying to update user record with avatar key and set temporary avatar field to true')
            return res.status(500).json({ status: 'error', error_code: 'UPLOAD_FAILED' });
        }

        let uploadImage: Upload | null = null
        try {
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
            log.error(err, 'failure while trying to upload avatar to the cloud s3 storage, aborting...')

            try { await uploadImage?.abort(); } catch (_) { }

            return res.status(500).json({ status: 'error', error_code: 'UPLOAD_FAILED' });
        }
        log.info('avatar uploaded')

        const userUnsafeUpdate2 = await runWithLogger(log, () => userRepository.unsafeUpdate(userId, { temporaryAvatar: false }))
        log.debug({ userUnsafeUpdate2 })
        if (userUnsafeUpdate2 !== true) {
            log.error('failure while trying to update user record and set temporary avatar field to false')

            try { await uploadImage?.abort(); } catch (_) { }

            return res.status(500).json({ status: 'error', error_code: 'UPLOAD_FAILED' });
        }

        res.status(201).send()
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
})

router.get('/avatar', async (req, res) => {
    const log = getLogger().child({ module: 'user', route: 'GET /api/user/avatar' });

    try {
        log.info('user avatar download request received')

        let { download: downloadStr } = await runWithLogger(log, () => validate(fetchAvatarSchema, req.query ?? {}))
        const download = downloadStr === 'true'
        log.debug({ download })

        const userId = req.user!.userId
        log.debug({ userId })

        const userRepository = new UserRepository()

        const user = await runWithLogger(log, () => userRepository.get(userId))
        log.debug({ user })
        if (!user) {
            log.info('user not found')
            return res.status(404).json({ status: 'error', error_code: 'USER_NOT_FOUND' });
        }

        if (!user.avatarKey || user.temporaryAvatar) {
            log.info('avatar not found')
            return res.status(404).json({ status: 'error', error_code: 'AVATAR_NOT_FOUND' });
        }
        log.info('user fetched')

        const s3Result = await s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: user.avatarKey,
            ResponseContentDisposition: download ? `attachment; filename="user_avatar.jpg"` : undefined,
        }));
        log.debug({ s3ResultMetaData: s3Result.Metadata, s3ResultContentType: s3Result.ContentType, s3ResultContentLength: s3Result.ContentLength })

        const stream = s3Result.Body;
        if (stream === undefined || stream === null) {
            log.warn('avatar not found in the cloud s3 storage')
            return res.status(404).json({ status: 'error', error_code: 'AVATAR_NOT_FOUND' });
        }

        res.setHeader("Content-Type", s3Result.ContentType || "image/jpg");
        res.setHeader("Content-Length", s3Result.ContentLength ?? "");

        res.status(200);
        (stream as any).pipe(res);

    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
})

router.delete('/avatar', async (req, res) => {
    try {
        console.log('/api/user/avatar')

        const userId = req.user!.userId

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
        if (rr !== true)
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
