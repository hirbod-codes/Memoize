import express, { } from 'express';
import { auth } from '../../middlewares/auth';
import { BUCKET_NAME, videoUploadTmpDir } from '../../configs';
import VideoRepository from '../../DB/repositories/VideoRepository';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'fs'
import { basename, join } from 'path'
import { generateThumbnail, generateWebCompatibleCopy, probeFile } from '../../ffmpeg';
import { generateStreamToken, verifyStreamToken } from '../../lib/signed_urls';
import { s3 } from '../..';
import { authorizeFeature, authorizeQuota } from '../../middlewares/authorization';
import { mkdir, rm, stat, unlink } from 'fs/promises';
import { deleteFromS3, detectContentType, receiveUpload, uploadToS3 } from '../../lib/file_management';
import { InvalidMediaError } from '../../errors/InvalidMediaError';
import { UploadTooLargeError } from '../../errors/UploadTooLargeError';
import { pipeline } from 'stream/promises';
import { UsageField } from '../../DB/models/Usage';
import { infoSchema, listSchema, postSchema, signedTokenSchema, thumbnailSchema, videoDeleteSchema, videoStreamForWebClientsSchema, videoStreamSchema } from './schemas';
import { handleError, validate } from '../../lib';
import { streamVideoFile } from './lib';
import { getLogger, runWithLogger } from '../../observability/requestLoggerContext';

const router = express.Router();

const ALLOWED_VIDEO_CODECS = new Set(['h264', 'hevc', 'vp9', 'av1', 'mpeg4']);

router.post('/', auth, authorizeFeature(['allowedContentTypes.video']), authorizeQuota(new Map([['valuePerContentCount.video', 1]])), async (req, res) => {
    let log = getLogger().child({ module: 'video', route: 'POST /api/video/' });

    try {
        log.info('Video upload request received');

        log.debug({ query: req.query });
        const { fileName, title } = await runWithLogger(log, () => validate(postSchema, req.query))
        log.info('input validated');
        log.debug({ fileName, title });

        const userId = req.user!.userId;
        log.debug({ userId });

        const videoRepository = new VideoRepository();

        // ------------------------------------------------------------------------- Checking whether title already exists...
        log.info('Checking whether title already exists...')

        const existing = await runWithLogger(log, () => videoRepository.getForUserByTitle(title, userId))
        log.debug({ titleTaken: existing });
        if (existing) {
            log.info({ title }, 'Rejected video upload: title already exists');
            return res.status(400).json({ message: 'Video title must be unique.' });
        }
        log.info('Checked title uniqueness')

        // ------------------------------------------------------------------------- Inserting video...
        log.info('Inserting video...')

        const videoInsertResult = await runWithLogger(log, () => videoRepository.insert({ title, fileName, userId, temporary: true }))
        log.debug({ insertResult: videoInsertResult });
        if (!videoInsertResult.acknowledged || !videoInsertResult.insertedId) {
            log.error({ insertResult: videoInsertResult }, 'Video info creation failed');
            return res.status(500).json({ ok: false, message: 'Video info creation failed' });
        }
        log.info('Inserted temporary video record')

        const videoId = videoInsertResult.insertedId.toString();
        log.debug({ videoId });

        // ------------------------------------------------------------------------- Set bucket keys
        log.info('Set bucket keys')

        const videoFileBucketKey = `video/${userId}/${videoId}`;
        const webCompatibleVideoFileBucketKey = `video/${userId}/web/${videoId}`;
        const thumbnailBucketKey = `video/thumbnail/${userId}/${videoId}`;
        log.debug({ videoFileBucketKey, webCompatibleVideoFileBucketKey, thumbnailBucketKey });
        log.info('Computed bucket keys')

        // ------------------------------------------------------------------------- Make the temporary directory
        log.info('Make the temporary directory')

        const jobDir = join(videoUploadTmpDir, videoId)
        await mkdir(jobDir, { recursive: true });
        log.debug({ jobDir })
        log.info('Created job scratch directory')

        const cleanupPaths: string[] = [];
        const cleanup = async () => {
            log.debug({ cleanupPaths, jobDir })
            log.info('Cleaning up temporary files')

            await Promise.all(cleanupPaths.map((p) => unlink(p).catch(() => { })));
            await rm(jobDir, { recursive: true, force: true }).catch(() => { });

            log.info('Cleaned up temporary files')
        };

        let rollbackPromises: undefined | Promise<any> = undefined
        try {
            const maxTotalStorageBytes = req.user!.privileges!.maxStorageBytes;
            log.debug({ maxTotalStorageBytes }, 'Resolved plan storage limit');

            // ------------------------------------------------------------------------- Store upload stream on disk
            log.info('Store upload stream on disk')

            const { path: inputPath, size: inputSize } = await runWithLogger(log, () => receiveUpload(req, maxTotalStorageBytes, jobDir))
            log.debug({ inputSize, inputPath })
            log.info('Upload received and stored to disk')
            cleanupPaths.push(inputPath);

            // ------------------------------------------------------------------------- Probe received file, get info and Validate it
            log.info('Probe received file, get info and Validate it')

            const info = await runWithLogger(log, () => probeFile(inputPath))
            log.debug({ info })
            const videoStream = info.streams.find((s) => s.codec_type === 'video');
            const audioStream = info.streams.find((s) => s.codec_type === 'audio');
            if (!videoStream || !ALLOWED_VIDEO_CODECS.has(videoStream.codec_name)) {
                log.warn({ codec: videoStream?.codec_name }, 'Rejected video upload: unsupported codec');
                throw new InvalidMediaError('Unsupported or unrecognized video format');
            }
            log.info('Probed uploaded file');

            const durationSeconds = info.format.duration ? parseFloat(info.format.duration) : undefined;
            log.debug({ durationSeconds })

            // ------------------------------------------------------------------------- Set file paths
            log.info('Set file paths')

            const webCopyPath = join(jobDir, `${videoId}-web.mp4`);
            const thumbnailPath = join(jobDir, `${videoId}-thumb.jpg`);
            cleanupPaths.push(webCopyPath, thumbnailPath);
            log.debug({ webCopyPath, thumbnailPath })
            log.info('Resolved output paths')

            // ------------------------------------------------------------------------- Wait for web compatible file and thumbnail to be generated and content type to be collected
            log.info('Waiting for web compatible file and thumbnail to be generated and content type to be collected...')

            const [, contentType] = await Promise.all([
                runWithLogger(log, () => generateWebCompatibleCopy(inputPath, jobDir, basename(webCopyPath).split('.')[0], videoStream, audioStream))
                    .then((result) => pipeline(result.outputStream, createWriteStream(webCopyPath!))),
                runWithLogger(log, () => detectContentType(inputPath))
                    .then((ct) => {
                        log.debug({ contentType: ct }, 'Detected content type');
                        return ct;
                    }),
                runWithLogger(log, () => generateThumbnail(inputPath, thumbnailPath, durationSeconds))
                    .then(() => log.debug('Thumbnail generated')),
            ]);
            log.info('done');

            // ------------------------------------------------------------------------- Validate generated file sizes
            log.info('Validate generated file sizes')

            const [webCopyStat, thumbnailStat] = await Promise.all([
                stat(webCopyPath),
                stat(thumbnailPath),
            ]);
            log.debug({ webCopyStat, thumbnailStat });

            const totalStorageBytes = inputSize + webCopyStat.size + thumbnailStat.size;
            log.debug({ inputSize, webCopySize: webCopyStat.size, thumbnailSize: thumbnailStat.size, totalStorageBytes });
            log.info('Computed total storage footprint')

            const quota = new Map<UsageField, number>([['storageBytesCount', totalStorageBytes]])
            if (await runWithLogger(log, () => authorizeQuota(quota, req)) !== true) {
                log.info({ totalStorageBytes }, 'Rejected video upload: exceeds plan storage limit');
                throw new UploadTooLargeError('Generated files exceed plan storage limit');
            }
            log.debug('Storage quota authorized');

            try {
                // ------------------------------------------------------------------------- Upload files to the S3 compatible object storage
                log.info('Upload files to the S3 compatible object storage')

                log.debug('Uploading files to object storage');
                await Promise.all([
                    runWithLogger(log, () => uploadToS3(createReadStream(inputPath), videoFileBucketKey, contentType.mimeType)),
                    runWithLogger(log, () => uploadToS3(createReadStream(webCopyPath), webCompatibleVideoFileBucketKey, 'video/mp4')),
                    runWithLogger(log, () => uploadToS3(createReadStream(thumbnailPath), thumbnailBucketKey, 'image/jpeg')),
                ]);
                log.info('Uploaded files to object storage');

                // ------------------------------------------------------------------------- Update video info in DB, Make it permanent and set content type
                log.info('Update video info in DB, Make it permanent and set content type')

                const updateResult = await runWithLogger(log, () => videoRepository.unsafeUpdate(videoId, userId, { contentType: contentType, temporary: false, bucketKey: videoFileBucketKey, webBucketKey: webCompatibleVideoFileBucketKey, thumbnailKey: thumbnailBucketKey, thumbnailFileName: basename(thumbnailPath) }))
                log.debug({ updateResult });
                if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
                    log.error({ updateResult }, 'Updating video record, failed');
                    throw new Error('failed to upload video')
                }
                log.info('Updated video record');

                // Work is durably done — clear reservations so the response-based rollback middleware becomes a no-op for this request no matter what happens to the connection from here on.
                // The connection might drop at this exact moment, which fires the res.on('close') and causes rollbackQuotaOnFailure middleware to rollback although content is properly uploaded and stored(a false alarm).
                req.quotaReservations = []
                log.info('Video upload finalized')
            } catch (error) {
                log.error({ err: error }, 'Post-upload finalization failed, rolling back stored artifacts')

                rollbackPromises = Promise.allSettled([
                    runWithLogger(log, () => deleteFromS3(videoFileBucketKey)).catch((_) => { }),
                    runWithLogger(log, () => deleteFromS3(webCompatibleVideoFileBucketKey)).catch((_) => { }),
                    runWithLogger(log, () => deleteFromS3(thumbnailBucketKey)).catch((_) => { }),
                    runWithLogger(log, () => videoRepository.delete(videoId)).catch((_) => { })
                ])

                throw error
            }
        } catch (err) {
            if (err instanceof UploadTooLargeError) {
                return res.status(403).json({ error: err.message });
            } else if (err instanceof InvalidMediaError) {
                return res.status(400).json({ error: err.message });
            } else {
                log.error({ err }, 'Video upload failed');
                return res.status(500).json({ error: 'Upload failed' });
            }
        } finally {
            await cleanup();
            if (rollbackPromises !== undefined) {
                await rollbackPromises;
                log.debug('Rollback of stored artifacts completed');
            }
        }

        return res.status(201).json({ id: videoId });
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
});

router.get('/', auth, async (req, res) => {
    let log = getLogger().child({ module: 'video', route: 'GET /api/video/' });

    try {
        log.info('Video list request received');

        log.debug({ query: req.query });
        const { page, pageSize } = await runWithLogger(log, () => validate(listSchema, req.query))
        log.info('input validated');
        log.debug({ page, pageSize });

        const userId = req.user!.userId;
        log.debug({ userId });

        const skip = (page - 1) * pageSize;

        log.info('fetching videos...');

        const videoRepository = new VideoRepository();
        const [items, total] = await Promise.all([
            runWithLogger(log, () => videoRepository.getPageForUser(userId, skip, pageSize)),
            runWithLogger(log, () => videoRepository.countForUser(userId)),
        ]);
        log.debug({ itemsLength: items.length, videosCount: total });

        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        log.debug({ totalPages });


        log.info('fetched videos');
        res.status(200).json({ items, page, pageSize, total, totalPages, hasMore: page < totalPages });
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
});

router.get('/info/', auth, async (req, res) => {
    let log = getLogger().child({ module: 'video', route: 'GET /api/video/info' });

    try {
        log.info('Video info request received');

        log.debug({ query: req.query });
        const { title, videoId } = await runWithLogger(log, () => validate(infoSchema, req.query))
        log.debug({ title, videoId });

        if (videoId === undefined && title === undefined)
            throw new Error('INVALID_INPUT')
        log.info('input validated');

        const userId = req.user!.userId;
        log.debug({ userId });

        const videoRepository = new VideoRepository()

        log.info('fetching video info');
        let result
        if (videoId)
            result = await runWithLogger(log, () => videoRepository.getForUser(videoId, userId))
        else
            result = await runWithLogger(log, () => videoRepository.getForUserByTitle(title!, userId))
        log.debug({ result })
        if (!result) {
            log.info('Video not found');
            return res.status(404).send()
        }

        log.info('fetched video info');
        log.debug({ videoId: result._id?.toString() }, 'Video found');
        res.status(200).json(result)
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
});

router.get('/singed_token', auth, async (req, res) => {
    let log = getLogger().child({ module: 'video', route: 'GET /api/video/singed_token' });

    try {
        log.info('Sign token request received');

        log.debug({ query: req.query });
        const { videoId } = await runWithLogger(log, () => validate(signedTokenSchema, req.query))
        log.debug({ videoId });
        log.info('input validated');

        const userId = req.user!.userId
        log.debug({ userId });

        const videoRepository = new VideoRepository()

        log.info('fetching video info for user');
        const video = await runWithLogger(log, () => videoRepository.getForUser(videoId, userId))
        log.debug({ video });
        if (!video) {
            log.info('Video not found');
            return res.status(404).json({ message: 'Video not found' });
        }
        log.info('Video ownership confirmed');

        const token = runWithLogger(log, () => generateStreamToken(videoId, userId))
        log.debug({ token });
        log.info('Issued signed stream token');

        return res.status(200).json({ token });
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
});

// For non web clients
router.get('/file/:videoId', auth, async (req, res) => {
    let log = getLogger().child({ module: 'video', route: 'GET /api/video/file/:videoId' });

    try {
        log.info('Video download/stream for non web clients request received');

        log.debug({ query: req.query, range: req.headers.range });
        const { videoId } = await runWithLogger(log, () => validate(videoStreamSchema, req.params))
        log.debug({ videoId });
        log.info('input validated');

        await runWithLogger(log, () => streamVideoFile(videoId, req.user!.userId, req, res, false))
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
});

// For web clients
router.get('/file/:token/:videoId', async (req, res) => {
    let log = getLogger().child({ module: 'video', route: 'GET /api/video/file/:token/:videoId' });

    try {
        log.info('Video download/stream for web clients request received');

        log.debug({ query: req.query, range: req.headers.range });
        const { videoId, token } = await runWithLogger(log, () => validate(videoStreamForWebClientsSchema, req.params))
        log.debug({ videoId, token });
        log.info('input validated');

        const { valid, userId } = runWithLogger(log, () => verifyStreamToken(token, videoId))
        log.debug({ valid, userId })

        if (valid !== true || !userId) {
            log.warn('Rejected web video file request: invalid or expired token');
            return res.status(401).send();
        }
        log.info('Verified stream token')

        await runWithLogger(log, () => streamVideoFile(videoId, userId, req, res, true))
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
});

router.get('/thumbnail/:videoId', auth, async (req, res) => {
    let log = getLogger().child({ module: 'video', route: 'GET /api/video/thumbnail/:videoId' });

    try {
        log.info('Thumbnail download request received');

        log.debug({ query: req.query, params: req.params });
        const { videoId, download: temp } = await runWithLogger(log, () => validate(thumbnailSchema, { videoId: req.params.videoId, download: req.query.download }))
        let download: boolean = temp === 'true'
        log.debug({ videoId, temp, download });
        log.info('input validated');

        const userId = req.user!.userId
        log.debug({ userId });

        const videoRepository = new VideoRepository()

        log.info('fetching video');
        const video = await runWithLogger(log, () => videoRepository.getForUser(videoId, userId))
        log.debug({ video });
        if (!video) {
            log.info('Video not found');
            return res.status(404).json({ message: 'Video not found' });
        }
        log.info('fetched video');

        if (!video || !video.thumbnailKey || !video.thumbnailFileName) {
            log.info('Video has no thumbnail');
            return res.status(404).json({ message: 'Video thumbnail not found' });
        }

        const result = await s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: video.thumbnailKey,
            ResponseContentDisposition: download ? `attachment; filename="${video.thumbnailFileName}"` : undefined,
        }));
        log.debug({ key: video.thumbnailKey, contentLength: result.ContentLength, contentType: result.ContentType });
        log.info('Fetched thumbnail from storage')

        const stream = result.Body as any;
        if (stream === undefined || stream === null) {
            log.warn({ key: video.thumbnailKey }, 'Thumbnail object has no body');
            return res.status(404).send();
        }

        res.setHeader("Content-Type", result.ContentType || "application/octet-stream");

        res.status(200);
        res.setHeader("Content-Length", result.ContentLength ?? "");

        log.info('Streaming thumbnail to client');
        (stream as any).pipe(res);
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
});

router.delete('/:videoId', auth, async (req, res) => {
    let log = getLogger().child({ module: 'video', route: 'DELETE /api/video/:videoId' });
    try {
        log.info('Video delete request received');

        log.debug({ params: req.params });
        const { videoId } = await runWithLogger(log, () => validate(videoDeleteSchema, req.params))
        log.debug({ videoId });
        log.info('input validated');

        const userId = req.user!.userId
        log.debug({ userId });

        const videoRepository = new VideoRepository()

        log.info('fetching video');
        const video = await runWithLogger(log, () => videoRepository.getForUser(videoId, userId))
        log.debug({ video });
        if (!video) {
            log.info('Video not found');
            res.status(404).json({ message: 'Video not found' });
            return
        }
        log.info('fetched video');

        log.info('making video temporary');
        const updateResult = await runWithLogger(log, () => videoRepository.unsafeUpdate(videoId, userId, { temporary: true }))
        log.debug({ updateResult });
        if (!updateResult.acknowledged || updateResult.matchedCount) {
            log.error({ updateResult }, 'Failed to mark video temporary before delete');
            return res.status(500).send()
        }
        log.info('Marked video temporary in DB before delete')

        log.info('deleting video file in s3 storage')
        const s3Result = await s3.send(
            new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: video.bucketKey
            })
        );
        log.info({ s3Result })
        log.info('deleted video file')

        if (video?.thumbnailKey) {
            log.info('deleting video thumbnail file in s3 storage')
            const s3ThumbnailResult = await s3.send(
                new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: video.thumbnailKey
                })
            );
            log.info({ s3ThumbnailResult })
            log.info('deleted video thumbnail file')
        }

        log.info('Deleting video record in DB')
        const videoRecordDeleteResult = await runWithLogger(log, () => videoRepository.delete(videoId))
        log.debug({ videoRecordDeleteResult });
        if (!videoRecordDeleteResult.acknowledged) {
            log.error({ videoRecordDeleteResult }, 'Failed to delete video record in DB');
            return res.status(500).send()
        }
        log.info('Deleted video record in DB')

        log.info('Video deleted successfully');
        res.status(200).send();
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
});

export { router as videoRoutes };
