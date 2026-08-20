import express, { Request, Response } from 'express';
import { string, ValidationError } from 'yup';
import { auth, authenticateToken } from '../middlewares/auth';
import { audioUploadTmpDir, BUCKET_NAME, ttsApiKey } from '../configs';
import AudioRepository from '../DB/repositories/AudioRepository';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { generateStreamToken, verifyStreamToken } from '../lib/signed_urls';
import { UserRepository } from '../DB/repositories/UserRepository';
import { httpsStreamRequest } from '../utils';
import { s3 } from '..';
import { authorizeFeature, authorizeQuota } from '../middlewares/authorization';
import { basename, join } from 'path';
import { mkdir, rm, stat, unlink } from 'fs/promises';
import { deleteFromS3, detectContentType, receiveUpload, uploadToS3 } from '../lib/file_management';
import { extractCoverArt, generateWebCompatibleCopy, isWebCompatible, probeFile } from '../ffmpeg';
import { InvalidMediaError } from '../errors/InvalidMediaError';
import { UploadTooLargeError } from '../errors/UploadTooLargeError';
import { createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { UsageField } from '../DB/models/Usage';

const router = express.Router();

const ALLOWED_AUDIO_CODECS = new Set([
    'aac', 'mp3', 'opus', 'vorbis', 'flac', 'alac',
    'pcm_s16le', 'pcm_s24le', 'pcm_f32le',
]);

router.post('/', auth, authorizeFeature(['allowedContentTypes.audio']), authorizeQuota(new Map([['valuePerContentCount.audio', 1]])), async (req, res) => {
    try {
        console.log('/api/audio', 'POST')

        console.log('Validating...')
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
            return res.status(400).json({ message: 'Invalid Audio info.' });
        }

        const userId = req.user!.userId

        const audioRepository = new AudioRepository()

        console.log("Checking weather title already exists...");
        // ------------------------------------------------------------------------- Checking weather title already exists...
        const audio = await audioRepository.getForUserByTitle(title, userId);
        if (audio)
            return res.status(400).json({ message: 'Audio title must be unique.' });

        console.log("Inserting audio...");
        // ------------------------------------------------------------------------- Inserting audio...
        const audioInsertResult = await audioRepository.insert({ title, userId, temporary: true })
        console.log("Audio insert result", audioInsertResult);
        if (!audioInsertResult.acknowledged || !audioInsertResult.insertedId)
            return res.status(500).json({ ok: false, message: 'Audio info creation failed' })
        const audioId = audioInsertResult.insertedId.toString()

        // ------------------------------------------------------------------------- Make the temporary directory
        const jobDir = join(audioUploadTmpDir, audioId)
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

            // ------------------------------------------------------------------------- Probe received file, get info and Validate it
            const info = await probeFile(inputPath);
            const audioStream = info.streams.find((s) => s.codec_type === 'audio');
            if (!audioStream || !ALLOWED_AUDIO_CODECS.has(audioStream.codec_name))
                throw new InvalidMediaError('Unsupported or unrecognized audio format');

            // ------------------------------------------------------------------------- Set bucket keys
            const isUploadWebCompatible = isWebCompatible(undefined, audioStream)
            const audioFileBucketKey = `audio/${userId}/${audioId}`;
            const webCompatibleAudioFileBucketKey = isUploadWebCompatible ? undefined : `audio/${userId}/web/${audioId}`;
            const coverArtBucketKey = `audio/cover_art/${userId}/${audioId}`;

            // ------------------------------------------------------------------------- Set file paths
            const webCopyPath = isUploadWebCompatible ? undefined : join(jobDir, `${audioId}-web.m4a`);
            if (webCopyPath)
                cleanupPaths.push(webCopyPath);

            const coverArtPath = join(jobDir, `${audioId}-thumb.jpg`);
            cleanupPaths.push(coverArtPath);

            // ------------------------------------------------------------------------- Wait for web compatible file and cover art to be generated and content type to be collected
            const promises = await Promise.all([
                detectContentType(inputPath),
                extractCoverArt(inputPath, info.streams, jobDir, basename(coverArtPath).split('.')[0]),
                ...(isUploadWebCompatible ? [] : [generateWebCompatibleCopy(inputPath, jobDir, basename(webCopyPath!).split('.')[0], undefined, audioStream).then((result) => pipeline(result.outputStream, createWriteStream(webCopyPath!)))]),
            ]);
            const contentType = promises[0]
            const coverArtResult = promises[1]

            // ------------------------------------------------------------------------- Validate generated file sizes
            const [coverArtStat, webCopyStat] = await Promise.all([
                stat(coverArtPath),
                ...(isUploadWebCompatible ? [] : [stat(webCopyPath!)]),
            ]);
            const totalStorageBytes = inputSize + (webCopyStat ? webCopyStat.size : 0) + coverArtStat.size;
            const quota = new Map<UsageField, number>([['storageBytesCount', totalStorageBytes]])
            if (await authorizeQuota(quota, req) !== true)
                throw new UploadTooLargeError('Generated files exceed plan storage limit');

            try {
                // ------------------------------------------------------------------------- Upload files to the S3 compatible object storage
                await Promise.all([
                    uploadToS3(createReadStream(inputPath), audioFileBucketKey, contentType.mimeType),
                    ...(isUploadWebCompatible ? [] : [uploadToS3(createReadStream(webCopyPath!), webCompatibleAudioFileBucketKey!, 'audio/mp4')]),
                    ...(coverArtResult ? [uploadToS3(createReadStream(coverArtResult.path), coverArtBucketKey, coverArtResult.mimeType)] : [])
                ]);

                // ------------------------------------------------------------------------- Update audio info in DB, Make it permanent and set content type
                const updateResult = await audioRepository.unsafeUpdate(audioId, userId, { contentType: contentType, temporary: false, bucketKey: audioFileBucketKey, webBucketKey: webCompatibleAudioFileBucketKey, coverArtKey: coverArtBucketKey, coverArtFileName: basename(coverArtPath) });
                if (!updateResult.acknowledged || updateResult.matchedCount !== 1)
                    throw new Error('failed to upload audio')

                // Work is durably done — clear reservations so the response-based rollback middleware becomes a no-op for this request no matter what happens to the connection from here on.
                // The connection might drop at this exact moment, which fires the res.on('close') and causes rollbackQuotaOnFailure middleware to rollback although content is properly uploaded and stored(a false alarm).
                req.quotaReservations = []
            } catch (error) {
                rollbackPromises = Promise.allSettled([
                    deleteFromS3(audioFileBucketKey).catch((_) => { }),
                    ...(webCompatibleAudioFileBucketKey ? [deleteFromS3(webCompatibleAudioFileBucketKey).catch((_) => { })] : []),
                    ...(coverArtResult ? [deleteFromS3(coverArtBucketKey).catch((_) => { })] : []),
                    audioRepository.delete(audioId).catch((_) => { })
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

        res.status(201).json({ id: audioId });
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Error uploading video file' });
    } finally {
        console.log('------------end------------');
    }
})

router.get('/info/', auth, async (req, res) => {
    try {
        console.log('/api/audio/info')

        console.log('Validation...')
        let audioId: string | undefined = undefined
        let title: string | undefined = undefined
        try {
            audioId = await string().objectIdString().optional().label('Audio id').validate(req.query.audioId?.toString())
            title = await string().optional().label('Title').validate(req.query.title?.toString())

            if (audioId === undefined && title === undefined) {
                res.status(400).json({ message: 'Invalid parameters' });
                return
            }
        } catch (err) {
            console.error(err)
            res.status(400).json({ message: 'Invalid parameters' });
            return
        }
        console.log({ audioId, title })

        const userId = req.user!.userId

        const audioRepository = new AudioRepository()

        let result
        if (audioId)
            result = await audioRepository.getForUser(audioId, userId)
        else
            result = await audioRepository.getForUserByTitle(title!, userId)

        console.log({ result })

        res.status(200).json(result)
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio' });
    } finally {
        console.log('------------end------------')
    }
});

router.get('/singed_token', auth, async (req, res) => {
    try {
        console.log('/api/audio/singed_token')

        console.log('Validation...')
        let audioId: string | undefined = undefined
        try {
            audioId = await string().objectIdString().required().label('Audio id').validate(req.query.audioId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }
        console.log({ audioId })

        const userId = req.user!.userId

        const audioRepository = new AudioRepository()

        console.log("Checking weather audio exists...");
        const audio = await audioRepository.getForUser(audioId, userId)
        if (!audio)
            return res.status(404).json({ message: 'Audio not found' });
        console.log({ audio })

        const token = generateStreamToken(audioId, userId);

        return res.status(200).json({ token });
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Error getting audio file' });
    } finally {
        console.log('------------end------------')
    }
});

router.get('/tts', async (req, res) => {
    try {
        console.log('/tts')

        console.log('Validation...')
        let text: string | undefined = undefined, userTtsApiKey: string | undefined = undefined, authToken: string | undefined = undefined
        try {
            text = await string().max(500).required().label('Text').validate(req.query.text?.toString())
            authToken = await string().max(500).required().label('Text').validate(req.query.authToken?.toString())
            userTtsApiKey = await string().max(500).optional().label('Token').validate(req.query.token?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }
        console.log({ text, userTtsApiKey })

        const result = authenticateToken(authToken)
        if (result === false)
            return res.status(401).send();

        const userId = (result as any).userId;

        if (!userTtsApiKey) {
            const ur = new UserRepository()
            const user = await ur.get(userId);
            if (user === false)
                return res.status(401).send();

            if (user.role !== 'admin' && user?.plan === 'free')
                return res.status(403).send();

            if (ttsApiKey)
                userTtsApiKey = ttsApiKey;
            else
                return res.status(400).json({ errors: ['this feature currently is unavailable.'] });
        }

        const stream = await httpsStreamRequest({ hostname: 'api.gapgpt.app', path: '/v1/audio/speech', method: 'POST', headers: { 'Authorization': `Bearer ${userTtsApiKey}`, 'Content-Type': 'application/json' } }, JSON.stringify({
            model: 'gemini-2.5-flash-preview-tts',
            input: text,
            voice: 'achernar',
            response_format: 'mp3'
        }))

        stream.on('error', (e) => {
            console.error(e);

            return res.status(500).send()
        })

        stream.pipe(res)
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio file' });
    } finally {
        console.log('------------end------------')
    }
})

// there are separate routes for downloading audio because web's media player doesn't support using authorization headers, therefor it uses signed urls instead.
// For non web applications
router.get('/file/:audioId', auth, async (req, res) => {
    try {
        console.log('/api/audio/file')

        console.log('Validation...')
        let audioId: string | undefined = undefined, download: boolean = false
        try {
            audioId = await string().objectIdString().required().label('Audio id').validate(req.params.audioId?.toString())
            let temp = await string().optional().label('Download').validate(req.query.download?.toString())
            download = temp === 'true';
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        console.log({ audioId })

        await streamAudioFile(audioId, req.user!.userId, req, res, true, download)
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio file' });
    } finally {
        console.log('------------end------------')
    }
});

// For web applications
router.get('/file/:audioId/:token', async (req, res) => {
    try {
        console.log('/api/audio/file/:audioId/:token')

        console.log('Validation...')
        let audioId: string | undefined = undefined, token: string | undefined = undefined, download: boolean = false
        try {
            token = await string().required().label('Token').validate(req.params.token?.toString())
            audioId = await string().objectIdString().required().label('Audio id').validate(req.params.audioId?.toString())
            let temp = await string().optional().label('Download').validate(req.query.download?.toString())
            download = temp === 'true';
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }
        console.log({ audioId })

        console.log('Verifying token...')
        const { valid, userId } = verifyStreamToken(token, audioId);
        if (valid !== true || !userId)
            return res.status(401).send();

        await streamAudioFile(audioId, userId, req, res, true, download)
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Error getting audio file' });
    } finally {
        console.log('------------end------------')
    }
});

async function streamAudioFile(audioId: string, userId: string, req: Request, res: Response, isWeb: boolean, download: boolean) {
    const audioRepository = new AudioRepository()

    console.log("Checking weather audio exists...");
    const audio = await audioRepository.getForUser(audioId, userId!)
    if (!audio || !audio.contentType || (isWeb && !audio.webBucketKey) || (!isWeb && !audio.bucketKey))
        return res.status(404).json({ message: 'Audio not found' });
    console.log({ audio })

    const range = req.headers.range;

    const result = await s3.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: isWeb ? audio.webBucketKey : audio.bucketKey,
        Range: range,
        ResponseContentDisposition: download ? `attachment; filename="${audio._id!.toString()}.${audio.contentType.extension}"` : undefined,
    }));
    console.log({ result, key: audio.bucketKey })

    if (result.Body === undefined || result.Body === null)
        return res.status(404).send();

    const body = result.Body as Readable;
    body.on('error', (err) => {
        console.error('S3 stream error:', err);
        if (!res.headersSent) res.status(500).end();
        else res.destroy();
    });

    res.status(range ? 206 : 200);
    res.setHeader('Content-Type', isWeb ? 'audio/m4a' : (audio.contentType?.mimeType ?? 'audio/m4a'));
    res.setHeader('Accept-Ranges', 'bytes');
    if (result.ContentRange) res.setHeader('Content-Range', result.ContentRange);
    if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength);

    body.pipe(res)
}

router.get('/coverArt/:audioId', auth, async (req, res) => {
    try {
        console.log('/api/audio/coverArt')

        console.log('Validation...')
        let audioId: string | undefined = undefined, download: boolean = false
        try {
            audioId = await string().objectIdString().required().label('Audio id').validate(req.params.audioId?.toString())
            let temp = await string().optional().label('Download').validate(req.query.download?.toString())
            download = temp === 'true';
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        console.log({ audioId })

        const userId = req.user!.userId

        const audioRepository = new AudioRepository()

        console.log("Checking weather audio exists...");
        const audio = await audioRepository.getForUser(audioId, userId)
        if (!audio || !audio.coverArtKey || !audio.coverArtFileName) {
            res.status(404).json({ message: 'Audio not found' });
            return
        }
        console.log({ audio })

        const result = await s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: audio.coverArtKey,
            ResponseContentDisposition: download ? `attachment; filename="${audio.coverArtFileName}"` : undefined,
        }));

        const stream = result.Body as any;
        if (stream === undefined || stream === null)
            return res.status(404).send();

        const contentLength = result.ContentLength;

        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Type", result.ContentType || "application/octet-stream");

        res.status(200);
        res.setHeader("Content-Length", contentLength ?? "");

        (stream as any).pipe(res);
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio file' });
    } finally {
        console.log('------------end------------')
    }
});

router.delete('/:audioId', auth, async (req, res) => {
    try {
        console.log('/api/audio', 'DELETE')

        console.log('Validation...')
        let audioId: string | undefined = undefined
        try {
            audioId = await string().objectIdString().required().label('Audio id').validate(req.params.audioId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ audioId })

        const userId = req.user!.userId

        const audioRepository = new AudioRepository()

        console.log("Checking weather audio exists...");
        const audio = await audioRepository.getForUser(audioId, userId)
        if (!audio) {
            res.status(404).json({ message: 'Audio not found' });
            return
        }
        console.log({ audio })

        console.log("Make audio temporary in DB to maintain consistency...");
        const r = await audioRepository.unsafeUpdate(audioId, userId, { temporary: true })
        if (!r.acknowledged || r.matchedCount)
            return res.status(500).send()

        console.log("Deleting audio file in the bucket storage...");
        await s3.send(
            new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: audio.bucketKey
            })
        );

        if (audio?.coverArtKey) {
            console.log("Deleting audio file cover art in the bucket storage...");
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: audio.coverArtKey
                })
            );
        }

        console.log("Deleting audio in DB...");
        const rr = await audioRepository.delete(audioId)
        if (!rr.acknowledged)
            return res.status(500).send()

        res.status(200).send();
    } catch (err) {
        res.status(500).json({ message: 'Error deleting audio' });
    } finally {
        console.log('------------end------------')
    }
});

export { router as audioRoutes };