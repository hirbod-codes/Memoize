import express, { } from 'express';
import { auth, authenticateToken } from '../../middlewares/auth';
import { audioUploadTmpDir, BUCKET_NAME, ttsApiKey } from '../../configs';
import AudioRepository from '../../DB/repositories/AudioRepository';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { generateStreamToken, verifyStreamToken } from '../../lib/signed_urls';
import { UserRepository } from '../../DB/repositories/UserRepository';
import { httpsStreamRequest } from '../../utils';
import { s3 } from '../..';
import { pipeline } from 'stream/promises';
import { getLogger, runWithLogger } from '../../observability/requestLoggerContext';
import { listQuerySchema, infoQuerySchema, signedTokenQuerySchema, ttsQuerySchema, fileParamsSchema, webFileParamsSchema, coverArtParamsSchema, deleteParamsSchema, postSchema } from './schemas';
import { handleError, validate } from '../../lib';
import { authorizeFeature, authorizeQuota } from '../../middlewares/authorization';
import { deleteFromS3, detectContentType, receiveUpload, uploadToS3 } from '../../lib/file_management';
import { extractCoverArt, generateWebCompatibleCopy, isWebCompatible, probeFile } from '../../ffmpeg';
import { InvalidMediaError } from '../../errors/InvalidMediaError';
import { join, basename } from 'path';
import { UsageField } from '../../DB/models/Usage';
import { UploadTooLargeError } from '../../errors/UploadTooLargeError';
import { mkdir, unlink, rm, stat } from 'fs/promises';
import { createWriteStream, createReadStream } from 'fs';
import { streamAudioFile } from './lib';

const router = express.Router();

const ALLOWED_AUDIO_CODECS = new Set([
    'aac', 'mp3', 'opus', 'vorbis', 'flac', 'alac',
    'pcm_s16le', 'pcm_s24le', 'pcm_f32le',
]);

router.post('/', auth, authorizeFeature(['allowedContentTypes.audio']), authorizeQuota(new Map([['valuePerContentCount.audio', 1]])), async (req, res) => {
    let log = getLogger().child({ module: 'audio', route: 'POST /api/audio/' });

    try {
        log.info('audio upload request received');

        log.debug({ query: req.query });
        const { fileName, title } = await runWithLogger(log, () => validate(postSchema, req.query))
        log.info('input validated');
        log.debug({ fileName, title });

        const userId = req.user!.userId
        log = log.child({ userId });

        const audioRepository = new AudioRepository()

        // ------------------------------------------------------------------------- Checking weather title already exists...
        const audio = await runWithLogger(log, () => audioRepository.getForUserByTitle(title, userId));
        log.debug({ audio });
        log.info('Checked title uniqueness');
        if (audio) {
            log.info('Rejected audio upload: title already exists');
            return res.status(400).json({ status: 'error', message: 'Audio title must be unique.' });
        }

        // ------------------------------------------------------------------------- Inserting audio...
        const audioInsertResult = await runWithLogger(log, () => audioRepository.insert({ title, userId, temporary: true }))
        log.debug({ audioInsertResult });
        if (!audioInsertResult.acknowledged || !audioInsertResult.insertedId) {
            log.error({ audioInsertResult }, 'temporary audio info creation failed');
            return res.status(500).json({ status: 'error', message: 'Audio info creation failed' })
        }
        log.info('Inserted temporary audio info record');

        const audioId = audioInsertResult.insertedId.toString()
        log.debug({ audioId })

        // ------------------------------------------------------------------------- Make the temporary directory
        const jobDir = join(audioUploadTmpDir, audioId)
        await mkdir(jobDir, { recursive: true });
        log.debug({ jobDir });
        log.info('Created job scratch directory');

        const cleanupPaths: string[] = [];
        const cleanup = async () => {
            log.debug({ cleanupPaths, jobDir });
            log.info('Cleaning up temp files');
            await Promise.all(cleanupPaths.map((p) => unlink(p).catch(() => { })));
            await rm(jobDir, { recursive: true, force: true }).catch(() => { });
        };

        let rollbackPromises: undefined | Promise<any> = undefined
        try {
            const maxTotalStorageBytes = req.user!.privileges!.maxStorageBytes;
            log.debug({ maxTotalStorageBytes }, 'Resolved plan storage limit');

            // ------------------------------------------------------------------------- Store upload stream on disk
            const { path: inputPath, size: inputSize } = await runWithLogger(log, () => receiveUpload(req, maxTotalStorageBytes, jobDir))
            cleanupPaths.push(inputPath)
            log.debug({ inputSize, inputPath })
            log.info('Upload received and stored to disk')

            // ------------------------------------------------------------------------- Probe received file, get info and Validate it
            const info = await runWithLogger(log, () => probeFile(inputPath))
            const audioStream = info.streams.find((s) => s.codec_type === 'audio')
            log.debug({ audioCodec: audioStream?.codec_name })
            log.info('Probed uploaded file')
            if (!audioStream || !ALLOWED_AUDIO_CODECS.has(audioStream.codec_name)) {
                log.warn({ codec: audioStream?.codec_name }, 'Rejected audio upload: unsupported codec')
                throw new InvalidMediaError('Unsupported or unrecognized audio format')
            }

            // ------------------------------------------------------------------------- Set bucket keys
            const isUploadWebCompatible = runWithLogger(log, () => isWebCompatible(undefined, audioStream))
            const audioFileBucketKey = `audio/${userId}/${audioId}`
            const webCompatibleAudioFileBucketKey = isUploadWebCompatible ? undefined : `audio/${userId}/web/${audioId}`
            const coverArtBucketKey = `audio/cover_art/${userId}/${audioId}`
            log.debug({ isUploadWebCompatible, audioFileBucketKey, webCompatibleAudioFileBucketKey, coverArtBucketKey })
            log.info('Computed bucket keys')

            // ------------------------------------------------------------------------- Set file paths
            const webCopyPath = isUploadWebCompatible ? undefined : join(jobDir, `${audioId}-web.m4a`)
            if (webCopyPath)
                cleanupPaths.push(webCopyPath);

            const coverArtPath = join(jobDir, `${audioId}-thumb.jpg`);
            cleanupPaths.push(coverArtPath);
            log.debug({ webCopyPath, coverArtPath });
            log.info('Resolved output paths');

            // ------------------------------------------------------------------------- Wait for web compatible file and cover art to be generated and content type to be collected
            const promises = await Promise.all([
                runWithLogger(log, () => detectContentType(inputPath)
                    .then((ct) => {
                        log.debug({ contentType: ct }, 'Detected content type');
                        return ct;
                    })),
                runWithLogger(log, () => extractCoverArt(inputPath, info.streams, jobDir, basename(coverArtPath).split('.')[0])
                    .then((r) => {
                        log.debug({ found: !!r }, 'Cover art extraction attempted');
                        return r;
                    })),
                ...(
                    isUploadWebCompatible
                        ? []
                        : [
                            runWithLogger(log, () => generateWebCompatibleCopy(inputPath, jobDir, basename(webCopyPath!).split('.')[0], undefined, audioStream)
                                .then((result) => pipeline(result.outputStream, createWriteStream(webCopyPath!)))
                                .then(() => log.debug('Web-compatible copy written to disk')))
                        ]
                ),
            ]);
            const contentType = promises[0]
            const coverArtResult = promises[1]
            log.debug({ isUploadWebCompatible, coverArtResult });
            log.info('Generated web compatible file and cover art');

            // ------------------------------------------------------------------------- Validate generated file sizes
            const [coverArtStat, webCopyStat] = await Promise.all([
                stat(coverArtPath),
                ...(isUploadWebCompatible ? [] : [stat(webCopyPath!)]),
            ]);
            const totalStorageBytes = inputSize + (webCopyStat ? webCopyStat.size : 0) + coverArtStat.size;
            log.debug({ inputSize, webCopySize: webCopyStat?.size ?? 0, coverArtSize: coverArtStat.size, totalStorageBytes }, 'Computed total storage footprint');
            const quota = new Map<UsageField, number>([['storageBytesCount', totalStorageBytes]])
            if (await runWithLogger(log, () => authorizeQuota(quota, req)) !== true) {
                log.info({ totalStorageBytes }, 'Rejected audio upload: exceeds plan storage limit');
                throw new UploadTooLargeError('Generated files exceed plan storage limit');
            }
            log.info('Storage quota authorized');

            try {
                // ------------------------------------------------------------------------- Upload files to the S3 compatible object storage
                log.info('Uploading files to object storage');
                await Promise.all([
                    runWithLogger(log, () => uploadToS3(createReadStream(inputPath), audioFileBucketKey, contentType.mimeType)),
                    ...(isUploadWebCompatible ? [] : [runWithLogger(log, () => uploadToS3(createReadStream(webCopyPath!), webCompatibleAudioFileBucketKey!, 'audio/mp4'))]),
                    ...(coverArtResult ? [runWithLogger(log, () => uploadToS3(createReadStream(coverArtResult.path), coverArtBucketKey, coverArtResult.mimeType))] : [])
                ]);
                log.debug({ audioFileBucketKey, webCompatibleAudioFileBucketKey, hasCoverArt: !!coverArtResult, totalStorageBytes });
                log.info('Uploaded files to object storage');

                // ------------------------------------------------------------------------- Update audio info in DB, Make it permanent and set content type
                const updateResult = await audioRepository.unsafeUpdate(audioId, userId, { contentType: contentType, temporary: false, bucketKey: audioFileBucketKey, webBucketKey: webCompatibleAudioFileBucketKey, coverArtKey: coverArtBucketKey, coverArtFileName: basename(coverArtPath) });
                log.debug({ updateResult });
                if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
                    log.info('updating audio record failed');
                    throw new Error('failed to upload audio')
                }
                log.info('Updated audio record');

                // Work is durably done — clear reservations so the response-based rollback middleware becomes a no-op for this request no matter what happens to the connection from here on.
                // The connection might drop at this exact moment, which fires the res.on('close') and causes rollbackQuotaOnFailure middleware to rollback although content is properly uploaded and stored(a false alarm).
                req.quotaReservations = []
                log.info({ totalStorageBytes }, 'Audio upload finalized');
            } catch (error) {
                log.error({ err: error }, 'Post-upload finalization failed, rolling back stored artifacts');
                rollbackPromises = Promise.allSettled([
                    runWithLogger(log, () => deleteFromS3(audioFileBucketKey).catch((_) => { })),
                    ...(webCompatibleAudioFileBucketKey ? [runWithLogger(log, () => deleteFromS3(webCompatibleAudioFileBucketKey).catch((_) => { }))] : []),
                    ...(coverArtResult ? [runWithLogger(log, () => deleteFromS3(coverArtBucketKey).catch((_) => { }))] : []),
                    runWithLogger(log, () => audioRepository.delete(audioId).catch((_) => { })),
                ])

                throw error
            }
        } catch (err) {
            if (err instanceof UploadTooLargeError) {
                res.status(403).json({ status: 'error', error: err.message });
            } else if (err instanceof InvalidMediaError) {
                res.status(400).json({ status: 'error', error: err.message });
            } else {
                log.error({ err }, 'Audio upload failed');
                res.status(500).json({ status: 'error', error: 'Upload failed' });
            }
        } finally {
            await cleanup();
            if (rollbackPromises !== undefined) {
                await rollbackPromises;
                log.info('Rollback of stored artifacts completed');
            }
        }

        res.status(201).json({ status: 'success', data: audioId });
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
})

router.get('/', auth, async (req, res) => {
    let log = getLogger().child({ module: 'audio', route: 'GET /api/audio/' });

    try {
        log.info('Audio list request received');

        log.debug({ query: req.query });
        const { page, pageSize } = await runWithLogger(log, () => validate(listQuerySchema, req.query));
        log.info('Input validated');
        log.debug({ page, pageSize });

        const userId = req.user!.userId;
        log = log.child({ userId, page, pageSize });

        const audioRepository = new AudioRepository();

        const skip = (page - 1) * pageSize;
        const [items, total] = await Promise.all([
            runWithLogger(log, () => audioRepository.getPageForUser(userId, skip, pageSize)),
            runWithLogger(log, () => audioRepository.countForUser(userId)),
        ]);
        log.debug({ count: items.length, total });
        log.info('Fetched audio page');

        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        log.info({ totalPages }, 'Listed audios');

        res.status(200).json({ status: 'success', data: { items, page, pageSize, total, totalPages, hasMore: page < totalPages, } });
    } catch (err) {
        runWithLogger(log, () => handleError(res, err));
    }
});

router.get('/info/', auth, async (req, res) => {
    let log = getLogger().child({ module: 'audio', route: 'GET /api/audio/info/' });

    try {
        log.info('Audio info request received');

        log.debug({ query: req.query });
        const { audioId, title } = await runWithLogger(log, () => validate(infoQuerySchema, req.query));
        log.info('Input validated');
        log.debug({ audioId, title });

        const userId = req.user!.userId;
        log = log.child({ userId, audioId, title });

        const audioRepository = new AudioRepository();

        const result = audioId
            ? await runWithLogger(log, () => audioRepository.getForUser(audioId, userId))
            : await runWithLogger(log, () => audioRepository.getForUserByTitle(title!, userId));
        log.debug({ result });
        log.info('Looked up audio info');

        if (!result) {
            log.info('Audio not found');
            return res.status(404).json({ status: 'error', message: 'Audio not found' });
        }

        res.status(200).json({ status: 'success', data: result });
    } catch (err) {
        runWithLogger(log, () => handleError(res, err));
    }
});

router.get('/singed_token', auth, async (req, res) => {
    let log = getLogger().child({ module: 'audio', route: 'GET /api/audio/singed_token' });

    try {
        log.info('Signed token request received');

        log.debug({ query: req.query });
        const { audioId } = await runWithLogger(log, () => validate(signedTokenQuerySchema, req.query));
        log.info('Input validated');
        log.debug({ audioId });

        const userId = req.user!.userId;
        log = log.child({ userId, audioId });

        const audioRepository = new AudioRepository();

        const audio = await runWithLogger(log, () => audioRepository.getForUser(audioId, userId));
        log.debug({ audio });
        log.info('Checked audio ownership');
        if (!audio) {
            log.info('Rejected signed token request: audio not found');
            return res.status(404).json({ status: 'error', message: 'Audio not found' });
        }

        const token = generateStreamToken(audioId, userId);
        log.info('Issued signed stream token');

        res.status(200).json({ status: 'success', data: token });
    } catch (err) {
        runWithLogger(log, () => handleError(res, err));
    }
});

router.get('/tts', async (req, res) => {
    let log = getLogger().child({ module: 'audio', route: 'GET /api/audio/tts' });

    try {
        log.info('TTS request received');

        // Deliberately not logging raw query: contains user content (`text`) and secrets (`token`/`authToken`).
        const { text, authToken, userTtsApiKey: userTtsApiKeyInput } = await runWithLogger(log, () => validate(ttsQuerySchema, req.query));
        log.info('Input validated');
        log.debug({ textLength: text.length, hasUserApiKey: !!userTtsApiKeyInput });

        const result = authenticateToken(authToken);
        if (result === false) {
            log.warn('Rejected TTS request: invalid auth token');
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userId = (result as any).userId;
        log = log.child({ userId });

        let userTtsApiKey = userTtsApiKeyInput;
        if (!userTtsApiKey) {
            const ur = new UserRepository();
            const user = await runWithLogger(log, () => ur.get(userId));
            log.debug({ user });
            if (!user) {
                log.warn('Rejected TTS request: user not found for authenticated token');
                return res.status(401).json({ status: 'error', message: 'Unauthorized' });
            }

            if (user.role !== 'admin' && user?.planTitle === 'free') {
                log.info({ plan: user.planTitle }, 'Rejected TTS request: plan does not include TTS');
                return res.status(403).json({ status: 'error', message: 'Your plan does not include text-to-speech' });
            }

            if (!ttsApiKey) {
                log.warn('Rejected TTS request: no server-side TTS API key configured');
                return res.status(400).json({ status: 'error', message: 'This feature is currently unavailable' });
            }
            userTtsApiKey = ttsApiKey;
            log.debug('Using server-side TTS API key');
        } else {
            log.debug('Using user-supplied TTS API key');
        }

        log.info('Requesting TTS audio from upstream provider');
        const stream = await runWithLogger(log, () => httpsStreamRequest(
            { hostname: 'api.gapgpt.app', path: '/v1/audio/speech', method: 'POST', headers: { 'Authorization': `Bearer ${userTtsApiKey}`, 'Content-Type': 'application/json' } },
            JSON.stringify({ model: 'gemini-2.5-flash-preview-tts', input: text, voice: 'achernar', response_format: 'mp3' })
        ));

        stream.on('error', (e) => {
            log.error({ err: e }, 'TTS upstream stream error');
            if (!res.headersSent) return runWithLogger(log, () => handleError(res, e));
            res.destroy();
        });

        log.info('Streaming TTS audio to client');
        stream.pipe(res);
    } catch (err) {
        runWithLogger(log, () => handleError(res, err));
    }
});

// there are separate routes for downloading audio because web's media player doesn't support using authorization headers, therefor it uses signed urls instead.
// For non web applications
router.get('/file/:audioId', auth, async (req, res) => {
    let log = getLogger().child({ module: 'audio', route: 'GET /api/audio/file/:audioId' });

    try {
        log.info('Audio file request received');

        log.debug({ params: req.params, query: req.query, range: req.headers.range });
        const { audioId, download: temp } = await runWithLogger(log, () => validate(fileParamsSchema, { ...req.params, ...req.query }));
        let download: boolean = temp === 'true'
        log.info('Input validated');
        log.debug({ audioId, download });

        log = log.child({ userId: req.user!.userId, audioId, download });

        await streamAudioFile(audioId, req.user!.userId, req, res, false, download, log);
    } catch (err) {
        runWithLogger(log, () => handleError(res, err));
    }
});

// For web applications
router.get('/file/:audioId/:token', async (req, res) => {
    let log = getLogger().child({ module: 'audio', route: 'GET /api/audio/file/:audioId/:token' });

    try {
        log.info('Web audio file request received');

        log.debug({ params: { audioId: req.params.audioId }, query: req.query, range: req.headers.range });
        const { audioId, token, download: temp } = await runWithLogger(log, () => validate(webFileParamsSchema, { ...req.params, ...req.query }));
        let download: boolean = temp === 'true'
        log.info('Input validated');
        log.debug({ audioId, download });

        log = log.child({ audioId, download });

        const { valid, userId } = verifyStreamToken(token, audioId);
        log.debug({ valid });
        log.info('Verified stream token');
        if (valid !== true || !userId) {
            log.warn('Rejected web audio file request: invalid or expired token');
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }
        log = log.child({ userId });

        await streamAudioFile(audioId, userId, req, res, true, download, log);
    } catch (err) {
        runWithLogger(log, () => handleError(res, err));
    }
});

router.get('/coverArt/:audioId', auth, async (req, res) => {
    let log = getLogger().child({ module: 'audio', route: 'GET /api/audio/coverArt/:audioId' });

    try {
        log.info('Cover art request received');

        log.debug({ params: req.params, query: req.query });
        const { audioId, download: temp } = await runWithLogger(log, () => validate(coverArtParamsSchema, { ...req.params, ...req.query }));
        let download: boolean = temp === 'true'
        log.info('Input validated');
        log.debug({ audioId, download });

        log = log.child({ userId: req.user!.userId, audioId, download });

        const userId = req.user!.userId;

        const audioRepository = new AudioRepository();

        const audio = await runWithLogger(log, () => audioRepository.getForUser(audioId, userId));
        log.debug({ audio });
        log.info('Checked audio ownership');
        if (!audio || !audio.coverArtKey || !audio.coverArtFileName) {
            log.info('Rejected cover art request: audio not found or has no cover art');
            return res.status(404).json({ status: 'error', message: 'Audio not found' });
        }

        const result = await runWithLogger(log, () => s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: audio.coverArtKey,
            ResponseContentDisposition: download ? `attachment; filename="${audio.coverArtFileName}"` : undefined,
        })));
        log.debug({ contentLength: result.ContentLength, contentType: result.ContentType });
        log.info('Fetched cover art from storage');

        const stream = result.Body as any;
        if (stream === undefined || stream === null) {
            log.warn('Cover art object has no body');
            return res.status(404).json({ status: 'error', message: 'Audio not found' });
        }

        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', result.ContentType || 'application/octet-stream');
        res.status(200);
        res.setHeader('Content-Length', result.ContentLength ?? '');

        log.info('Streaming cover art to client');
        stream.pipe(res);
    } catch (err) {
        runWithLogger(log, () => handleError(res, err));
    }
});

router.delete('/:audioId', auth, async (req, res) => {
    let log = getLogger().child({ module: 'audio', route: 'DELETE /api/audio/:audioId' });

    try {
        log.info('Audio delete request received');

        log.debug({ params: req.params });
        const { audioId } = await runWithLogger(log, () => validate(deleteParamsSchema, req.params));
        log.info('Input validated');
        log.debug({ audioId });

        const userId = req.user!.userId;
        log = log.child({ userId, audioId });

        const audioRepository = new AudioRepository();

        const audio = await runWithLogger(log, () => audioRepository.getForUser(audioId, userId));
        log.debug({ audio });
        log.info('Checked audio ownership');
        if (!audio) {
            log.info('Rejected audio delete request: audio not found');
            return res.status(404).json({ status: 'error', message: 'Audio not found' });
        }

        const r = await runWithLogger(log, () => audioRepository.unsafeUpdate(audioId, userId, { temporary: true }));
        log.debug({ updateResult: r });
        if (!r.acknowledged || r.matchedCount) {
            log.error({ updateResult: r }, 'Failed to mark audio temporary before delete');
            return res.status(500).json({ status: 'error', message: 'Error deleting audio' });
        }
        log.info('Marked audio temporary before delete');

        await runWithLogger(log, () => s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: audio.bucketKey })));
        log.debug({ key: audio.bucketKey });
        log.info('Deleted audio file from storage');

        if (audio?.coverArtKey) {
            await runWithLogger(log, () => s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: audio.coverArtKey })));
            log.debug({ key: audio.coverArtKey });
            log.info('Deleted cover art from storage');
        }

        const rr = await runWithLogger(log, () => audioRepository.delete(audioId));
        log.debug({ deleteResult: rr });
        if (!rr.acknowledged) {
            log.error({ deleteResult: rr }, 'Failed to delete audio record from DB');
            return res.status(500).json({ status: 'error', message: 'Error deleting audio' });
        }
        log.info('Audio deleted');

        res.status(204).json({ status: 'success' });
    } catch (err) {
        runWithLogger(log, () => handleError(res, err));
    }
});

export { router as audioRoutes };