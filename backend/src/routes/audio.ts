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
import { getLogger } from '../observability/requestContext';

const router = express.Router();

const ALLOWED_AUDIO_CODECS = new Set([
    'aac', 'mp3', 'opus', 'vorbis', 'flac', 'alac',
    'pcm_s16le', 'pcm_s24le', 'pcm_f32le',
]);

router.post('/', auth, authorizeFeature(['allowedContentTypes.audio']), authorizeQuota(new Map([['valuePerContentCount.audio', 1]])), async (req, res) => {
    let reqLog = getLogger().child({ module: 'audio', route: 'POST /audio' });
    try {
        reqLog.debug({ query: req.query }, 'Audio upload request received');

        // ------------------------------------------------------------------------- Validating...
        let fileName: string | undefined, title: string | undefined
        try {
            title = await string().required().label('Title').validate(req.query.title?.toString())
            fileName = await string().required().label('File name').validate(req.query.fileName?.toString())
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected audio upload: invalid metadata');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected audio upload: invalid metadata');
            return res.status(400).json({ message: 'Invalid Audio info.' });
        }
        reqLog.debug({ title, fileName }, 'Validated upload metadata');

        const userId = req.user!.userId
        reqLog = reqLog.child({ userId });

        const audioRepository = new AudioRepository()

        // ------------------------------------------------------------------------- Checking weather title already exists...
        const audio = await audioRepository.getForUserByTitle(title, userId);
        reqLog.debug({ titleTaken: !!audio }, 'Checked title uniqueness');
        if (audio) {
            reqLog.info({ title }, 'Rejected audio upload: title already exists');
            return res.status(400).json({ message: 'Audio title must be unique.' });
        }

        // ------------------------------------------------------------------------- Inserting audio...
        const audioInsertResult = await audioRepository.insert({ title, userId, temporary: true })
        reqLog.debug({ insertResult: audioInsertResult }, 'Inserted temporary audio record');
        if (!audioInsertResult.acknowledged || !audioInsertResult.insertedId) {
            reqLog.error({ insertResult: audioInsertResult }, 'Audio info creation failed');
            return res.status(500).json({ ok: false, message: 'Audio info creation failed' })
        }
        const audioId = audioInsertResult.insertedId.toString()
        reqLog = reqLog.child({ audioId });
        reqLog.info('Created temporary audio record');

        // ------------------------------------------------------------------------- Make the temporary directory
        const jobDir = join(audioUploadTmpDir, audioId)
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

            // ------------------------------------------------------------------------- Probe received file, get info and Validate it
            const info = await probeFile(inputPath);
            const audioStream = info.streams.find((s) => s.codec_type === 'audio');
            reqLog.debug({ audioCodec: audioStream?.codec_name }, 'Probed uploaded file');
            if (!audioStream || !ALLOWED_AUDIO_CODECS.has(audioStream.codec_name)) {
                reqLog.warn({ codec: audioStream?.codec_name }, 'Rejected audio upload: unsupported codec');
                throw new InvalidMediaError('Unsupported or unrecognized audio format');
            }

            // ------------------------------------------------------------------------- Set bucket keys
            const isUploadWebCompatible = isWebCompatible(undefined, audioStream)
            const audioFileBucketKey = `audio/${userId}/${audioId}`;
            const webCompatibleAudioFileBucketKey = isUploadWebCompatible ? undefined : `audio/${userId}/web/${audioId}`;
            const coverArtBucketKey = `audio/cover_art/${userId}/${audioId}`;
            reqLog.debug({ isUploadWebCompatible, audioFileBucketKey, webCompatibleAudioFileBucketKey, coverArtBucketKey }, 'Computed bucket keys');

            // ------------------------------------------------------------------------- Set file paths
            const webCopyPath = isUploadWebCompatible ? undefined : join(jobDir, `${audioId}-web.m4a`);
            if (webCopyPath)
                cleanupPaths.push(webCopyPath);

            const coverArtPath = join(jobDir, `${audioId}-thumb.jpg`);
            cleanupPaths.push(coverArtPath);

            reqLog.debug({ webCopyPath, coverArtPath }, 'Resolved output paths');

            // ------------------------------------------------------------------------- Wait for web compatible file and cover art to be generated and content type to be collected
            const promises = await Promise.all([
                detectContentType(inputPath).then((ct) => {
                    reqLog.debug({ contentType: ct }, 'Detected content type');
                    return ct;
                }),
                extractCoverArt(inputPath, info.streams, jobDir, basename(coverArtPath).split('.')[0]).then((r) => {
                    reqLog.debug({ found: !!r }, 'Cover art extraction attempted');
                    return r;
                }),
                ...(isUploadWebCompatible ? [] : [generateWebCompatibleCopy(inputPath, jobDir, basename(webCopyPath!).split('.')[0], undefined, audioStream)
                    .then((result) => pipeline(result.outputStream, createWriteStream(webCopyPath!)))
                    .then(() => reqLog.debug('Web-compatible copy written to disk'))]),
            ]);
            const contentType = promises[0]
            const coverArtResult = promises[1]
            reqLog.info({ isUploadWebCompatible, hasCoverArt: !!coverArtResult }, 'Generated derived files');

            // ------------------------------------------------------------------------- Validate generated file sizes
            const [coverArtStat, webCopyStat] = await Promise.all([
                stat(coverArtPath),
                ...(isUploadWebCompatible ? [] : [stat(webCopyPath!)]),
            ]);
            const totalStorageBytes = inputSize + (webCopyStat ? webCopyStat.size : 0) + coverArtStat.size;
            reqLog.debug({ inputSize, webCopySize: webCopyStat?.size ?? 0, coverArtSize: coverArtStat.size, totalStorageBytes }, 'Computed total storage footprint');
            const quota = new Map<UsageField, number>([['storageBytesCount', totalStorageBytes]])
            if (await authorizeQuota(quota, req) !== true) {
                reqLog.info({ totalStorageBytes }, 'Rejected audio upload: exceeds plan storage limit');
                throw new UploadTooLargeError('Generated files exceed plan storage limit');
            }
            reqLog.debug('Storage quota authorized');

            try {
                // ------------------------------------------------------------------------- Upload files to the S3 compatible object storage
                reqLog.debug('Uploading files to object storage');
                await Promise.all([
                    uploadToS3(createReadStream(inputPath), audioFileBucketKey, contentType.mimeType),
                    ...(isUploadWebCompatible ? [] : [uploadToS3(createReadStream(webCopyPath!), webCompatibleAudioFileBucketKey!, 'audio/mp4')]),
                    ...(coverArtResult ? [uploadToS3(createReadStream(coverArtResult.path), coverArtBucketKey, coverArtResult.mimeType)] : [])
                ]);
                reqLog.info({ audioFileBucketKey, webCompatibleAudioFileBucketKey, hasCoverArt: !!coverArtResult, totalStorageBytes }, 'Uploaded files to object storage');

                // ------------------------------------------------------------------------- Update audio info in DB, Make it permanent and set content type
                const updateResult = await audioRepository.unsafeUpdate(audioId, userId, { contentType: contentType, temporary: false, bucketKey: audioFileBucketKey, webBucketKey: webCompatibleAudioFileBucketKey, coverArtKey: coverArtBucketKey, coverArtFileName: basename(coverArtPath) });
                reqLog.debug({ updateResult }, 'Updated audio record');
                if (!updateResult.acknowledged || updateResult.matchedCount !== 1)
                    throw new Error('failed to upload audio')

                // Work is durably done — clear reservations so the response-based rollback middleware becomes a no-op for this request no matter what happens to the connection from here on.
                // The connection might drop at this exact moment, which fires the res.on('close') and causes rollbackQuotaOnFailure middleware to rollback although content is properly uploaded and stored(a false alarm).
                req.quotaReservations = []
                reqLog.info({ totalStorageBytes }, 'Audio upload finalized');
            } catch (error) {
                reqLog.error({ err: error }, 'Post-upload finalization failed, rolling back stored artifacts');
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
                reqLog.error({ err }, 'Audio upload failed');
                res.status(500).json({ error: 'Upload failed' });
            }
        } finally {
            await cleanup();
            if (rollbackPromises !== undefined) {
                await rollbackPromises;
                reqLog.debug('Rollback of stored artifacts completed');
            }
        }

        res.status(201).json({ id: audioId });
    } catch (err) {
        reqLog.error({ err }, 'Unhandled error in audio upload route');
        return res.status(500).json({ message: 'Error uploading audio file' });
    }
})

router.get('/info/', auth, async (req, res) => {
    let reqLog = getLogger().child({ module: 'audio', route: 'GET /audio/info' });
    try {
        reqLog.debug({ query: req.query }, 'Audio info request received');

        let audioId: string | undefined = undefined
        let title: string | undefined = undefined
        try {
            audioId = await string().objectIdString().optional().label('Audio id').validate(req.query.audioId?.toString())
            title = await string().optional().label('Title').validate(req.query.title?.toString())

            if (audioId === undefined && title === undefined) {
                reqLog.warn('Rejected audio info request: missing id and title');
                return res.status(400).json({ message: 'Invalid parameters' });
            }
        } catch (err) {
            reqLog.warn({ err }, 'Rejected audio info request: invalid parameters');
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        reqLog.debug({ title, audioId }, 'Validated metadata');

        const userId = req.user!.userId
        reqLog = reqLog.child({ userId, audioId, title });
        reqLog.debug('Validated lookup parameters');

        const audioRepository = new AudioRepository()

        let result
        if (audioId)
            result = await audioRepository.getForUser(audioId, userId)
        else
            result = await audioRepository.getForUserByTitle(title!, userId)

        if (!result) {
            reqLog.info('Audio not found');
            return res.status(404).send()
        } else {
            reqLog.debug({ audioId: result._id?.toString() }, 'Audio found');
        }

        res.status(200).json(result)
    } catch (err) {
        reqLog.error({ err }, 'Failed to get audio info');
        res.status(500).json({ message: 'Error getting audio' });
    }
});

router.get('/singed_token', auth, async (req, res) => {
    let reqLog = getLogger().child({ module: 'audio', route: 'GET /audio/singed_token' });
    try {
        reqLog.debug({ query: req.query }, 'Signed token request received');

        let audioId: string | undefined = undefined
        try {
            audioId = await string().objectIdString().required().label('Audio id').validate(req.query.audioId?.toString())
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected signed token request: invalid parameters');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected signed token request: invalid parameters');
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }

        const userId = req.user!.userId
        reqLog = reqLog.child({ userId, audioId });

        const audioRepository = new AudioRepository()

        const audio = await audioRepository.getForUser(audioId, userId)
        if (!audio) {
            reqLog.info('Audio not found');
            return res.status(404).json({ message: 'Audio not found' });
        }
        reqLog.debug('Audio ownership confirmed');

        const token = generateStreamToken(audioId, userId);
        reqLog.info('Issued signed stream token');

        return res.status(200).json({ token });
    } catch (err) {
        reqLog.error({ err }, 'Failed to issue signed token');
        res.status(500).json({ message: 'Error getting audio file' });
    }
});

router.get('/tts', async (req, res) => {
    let reqLog = getLogger().child({ module: 'audio', route: 'GET /tts' });
    try {
        reqLog.debug({ textLength: req.query.text?.toString().length, hasToken: !!req.query.token }, 'TTS request received');

        let text: string | undefined = undefined, userTtsApiKey: string | undefined = undefined, authToken: string | undefined = undefined
        try {
            text = await string().max(500).required().label('Text').validate(req.query.text?.toString())
            authToken = await string().max(500).required().label('Text').validate(req.query.authToken?.toString())
            userTtsApiKey = await string().max(500).optional().label('Token').validate(req.query.token?.toString())
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected TTS request: invalid parameters');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected TTS request: invalid parameters');
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }
        // Deliberately not logging `text` (user content) or userTtsApiKey/authToken
        // (secrets) beyond presence/length above.

        const result = authenticateToken(authToken)
        if (result === false) {
            reqLog.warn('Rejected TTS request: invalid auth token');
            return res.status(401).send();
        }

        const userId = (result as any).userId;
        reqLog = reqLog.child({ userId });

        if (!userTtsApiKey) {
            const ur = new UserRepository()
            const user = await ur.get(userId);
            if (user === false) {
                reqLog.warn('Rejected TTS request: user not found for authenticated token');
                return res.status(401).send();
            }

            if (user.role !== 'admin' && user?.plan === 'free') {
                reqLog.info({ plan: user.plan }, 'Rejected TTS request: plan does not include TTS');
                return res.status(403).send();
            }

            if (ttsApiKey) {
                userTtsApiKey = ttsApiKey;
                reqLog.debug('Using server-side TTS API key');
            } else {
                reqLog.warn('Rejected TTS request: no server-side TTS API key configured');
                return res.status(400).json({ errors: ['this feature currently is unavailable.'] });
            }
        } else {
            reqLog.debug('Using user-supplied TTS API key');
        }

        reqLog.info('Requesting TTS audio from upstream provider');
        const stream = await httpsStreamRequest({ hostname: 'api.gapgpt.app', path: '/v1/audio/speech', method: 'POST', headers: { 'Authorization': `Bearer ${userTtsApiKey}`, 'Content-Type': 'application/json' } }, JSON.stringify({
            model: 'gemini-2.5-flash-preview-tts',
            input: text,
            voice: 'achernar',
            response_format: 'mp3'
        }))

        stream.on('error', (e) => {
            reqLog.error({ err: e }, 'TTS upstream stream error');
            return res.status(500).send()
        })

        stream.pipe(res)
    } catch (err) {
        reqLog.error({ err }, 'Failed to get TTS audio');
        res.status(500).json({ message: 'Error getting audio file' });
    }
})

// there are separate routes for downloading audio because web's media player doesn't support using authorization headers, therefor it uses signed urls instead.
// For non web applications
router.get('/file/:audioId', auth, async (req, res) => {
    let reqLog = getLogger().child({ module: 'audio', route: 'GET /audio/file/:audioId' });
    try {
        reqLog.debug({ params: req.params, query: req.query, range: req.headers.range }, 'Audio file request received');

        let audioId: string | undefined = undefined, download: boolean = false
        try {
            audioId = await string().objectIdString().required().label('Audio id').validate(req.params.audioId?.toString())
            let temp = await string().optional().label('Download').validate(req.query.download?.toString())
            download = temp === 'true';
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected audio file request: invalid parameters');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected audio file request: invalid parameters');
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        reqLog.debug({ audioId, download }, 'Validated metadata');

        reqLog = reqLog.child({ userId: req.user!.userId, audioId, download });

        await streamAudioFile(audioId, req.user!.userId, req, res, false, download, reqLog)
    } catch (err) {
        reqLog.error({ err }, 'Failed to stream audio file');
        res.status(500).json({ message: 'Error getting audio file' });
    }
});

// For web applications
router.get('/file/:audioId/:token', async (req, res) => {
    let reqLog = getLogger().child({ module: 'audio', route: 'GET /audio/file/:audioId/:token' });
    try {
        reqLog.debug({ params: { audioId: req.params.audioId }, query: req.query, range: req.headers.range }, 'Web audio file request received');

        let audioId: string | undefined = undefined, token: string | undefined = undefined, download: boolean = false
        try {
            token = await string().required().label('Token').validate(req.params.token?.toString())
            audioId = await string().objectIdString().required().label('Audio id').validate(req.params.audioId?.toString())
            let temp = await string().optional().label('Download').validate(req.query.download?.toString())
            download = temp === 'true';
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected web audio file request: invalid parameters');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected web audio file request: invalid parameters');
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }
        reqLog = reqLog.child({ audioId, download });

        const { valid, userId } = verifyStreamToken(token, audioId);
        reqLog.debug({ valid }, 'Verified stream token');
        if (valid !== true || !userId) {
            reqLog.warn('Rejected web audio file request: invalid or expired token');
            return res.status(401).send();
        }
        reqLog = reqLog.child({ userId });

        await streamAudioFile(audioId, userId, req, res, true, download, reqLog)
    } catch (err) {
        reqLog.error({ err }, 'Failed to stream web audio file');
        res.status(500).json({ message: 'Error getting audio file' });
    }
});

async function streamAudioFile(audioId: string, userId: string, req: Request, res: Response, isWeb: boolean, download: boolean, reqLog = getLogger().child({ module: 'audio' })) {
    const audioRepository = new AudioRepository()

    const audio = await audioRepository.getForUser(audioId, userId!)
    if (!audio || !audio.contentType || (isWeb && !audio.webBucketKey) || (!isWeb && !audio.bucketKey)) {
        reqLog.info({ hasAudio: !!audio, isWeb }, 'Audio not found or missing expected bucket key');
        return res.status(404).json({ message: 'Audio not found' });
    }

    const range = req.headers.range;
    const key = isWeb ? audio.webBucketKey : audio.bucketKey;
    reqLog.debug({ key, range, download }, 'Fetching object from storage');

    const result = await s3.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Range: range,
        ResponseContentDisposition: download ? `attachment; filename="${audio._id!.toString()}.${audio.contentType.extension}"` : undefined,
    }));
    reqLog.debug({ key, range, contentLength: result.ContentLength, contentRange: result.ContentRange }, 'Fetched object from storage');

    if (result.Body === undefined || result.Body === null) {
        reqLog.warn({ key }, 'Storage object has no body');
        return res.status(404).send();
    }

    const body = result.Body as Readable;
    body.on('error', (err) => {
        reqLog.error({ err, key }, 'S3 stream error while serving audio file');
        if (!res.headersSent) res.status(500).end();
        else res.destroy();
    });

    res.status(range ? 206 : 200);
    res.setHeader('Content-Type', isWeb ? 'audio/m4a' : (audio.contentType?.mimeType ?? 'audio/m4a'));
    res.setHeader('Accept-Ranges', 'bytes');
    if (result.ContentRange) res.setHeader('Content-Range', result.ContentRange);
    if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength);

    reqLog.info({ key, range, download, statusCode: range ? 206 : 200 }, 'Streaming audio file to client');
    body.pipe(res)
}

router.get('/coverArt/:audioId', auth, async (req, res) => {
    let reqLog = getLogger().child({ module: 'audio', route: 'GET /audio/coverArt/:audioId' });
    try {
        reqLog.debug({ params: req.params, query: req.query }, 'Cover art request received');

        let audioId: string | undefined = undefined, download: boolean = false
        try {
            audioId = await string().objectIdString().required().label('Audio id').validate(req.params.audioId?.toString())
            let temp = await string().optional().label('Download').validate(req.query.download?.toString())
            download = temp === 'true';
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected cover art request: invalid parameters');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected cover art request: invalid parameters');
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        reqLog = reqLog.child({ userId: req.user!.userId, audioId, download });

        const userId = req.user!.userId

        const audioRepository = new AudioRepository()

        const audio = await audioRepository.getForUser(audioId, userId)
        if (!audio || !audio.coverArtKey || !audio.coverArtFileName) {
            reqLog.info({ hasAudio: !!audio }, 'Audio not found or has no cover art');
            res.status(404).json({ message: 'Audio not found' });
            return
        }
        reqLog.debug({ audio }, 'Audio found');

        reqLog.debug({ coverArtKey: audio.coverArtKey }, 'Fetching cover art from storage');
        const result = await s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: audio.coverArtKey,
            ResponseContentDisposition: download ? `attachment; filename="${audio.coverArtFileName}"` : undefined,
        }));
        reqLog.debug({ key: audio.coverArtKey, contentLength: result.ContentLength, contentType: result.ContentType }, 'Fetched cover art from storage');

        const stream = result.Body as any;
        if (stream === undefined || stream === null) {
            reqLog.warn({ key: audio.coverArtKey }, 'Cover art object has no body');
            return res.status(404).send();
        }

        const contentLength = result.ContentLength;

        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Type", result.ContentType || "application/octet-stream");

        res.status(200);
        res.setHeader("Content-Length", contentLength ?? "");

        reqLog.info({ key: audio.coverArtKey, download }, 'Streaming cover art to client');
        (stream as any).pipe(res);
    } catch (err) {
        reqLog.error({ err }, 'Failed to get cover art');
        res.status(500).json({ message: 'Error getting audio file' });
    }
});

router.delete('/:audioId', auth, async (req, res) => {
    let reqLog = getLogger().child({ module: 'audio', route: 'DELETE /audio/:audioId' });
    try {
        reqLog.debug({ params: req.params }, 'Audio delete request received');

        let audioId: string | undefined = undefined
        try {
            audioId = await string().objectIdString().required().label('Audio id').validate(req.params.audioId?.toString())
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected audio delete request: invalid parameters');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected audio delete request: invalid parameters');
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        reqLog.debug({ audioId }, 'Validated metadata');

        const userId = req.user!.userId
        reqLog = reqLog.child({ userId, audioId });

        const audioRepository = new AudioRepository()

        const audio = await audioRepository.getForUser(audioId, userId)
        if (!audio) {
            reqLog.info('Audio not found');
            res.status(404).json({ message: 'Audio not found' });
            return
        }
        reqLog.debug({ audio, bucketKey: audio.bucketKey, coverArtKey: audio.coverArtKey }, 'Audio found, starting delete');

        const r = await audioRepository.unsafeUpdate(audioId, userId, { temporary: true })
        reqLog.debug({ updateResult: r }, 'Marked audio temporary in DB before delete');
        if (!r.acknowledged || r.matchedCount) {
            reqLog.error({ updateResult: r }, 'Failed to mark audio temporary before delete');
            return res.status(500).send()
        }

        await s3.send(
            new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: audio.bucketKey
            })
        );
        reqLog.debug({ key: audio.bucketKey }, 'Deleted audio file from storage');

        if (audio?.coverArtKey) {
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: audio.coverArtKey
                })
            );
            reqLog.debug({ key: audio.coverArtKey }, 'Deleted cover art from storage');
        }

        const rr = await audioRepository.delete(audioId)
        reqLog.debug({ deleteResult: rr }, 'Deleted audio record from DB');
        if (!rr.acknowledged) {
            reqLog.error({ deleteResult: rr }, 'Failed to delete audio record from DB');
            return res.status(500).send()
        }

        reqLog.info('Audio deleted');
        res.status(200).send();
    } catch (err) {
        reqLog.error({ err }, 'Failed to delete audio');
        res.status(500).json({ message: 'Error deleting audio' });
    }
});

export { router as audioRoutes };
