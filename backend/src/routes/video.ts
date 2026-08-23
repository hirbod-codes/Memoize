import express, { Request, Response } from 'express';
import { string, ValidationError } from 'yup';
import { auth } from '../middlewares/auth';
import { BUCKET_NAME, videoUploadTmpDir } from '../configs';
import VideoRepository from '../DB/repositories/VideoRepository';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'fs'
import { basename, join } from 'path'
import { generateThumbnail, generateWebCompatibleCopy, probeFile } from '../ffmpeg';
import { Readable } from 'stream';
import { generateStreamToken, verifyStreamToken } from '../lib/signed_urls';
import { s3 } from '..';
import { authorizeFeature, authorizeQuota } from '../middlewares/authorization';
import { mkdir, rm, stat, unlink } from 'fs/promises';
import { deleteFromS3, detectContentType, receiveUpload, uploadToS3 } from '../lib/file_management';
import { InvalidMediaError } from '../errors/InvalidMediaError';
import { UploadTooLargeError } from '../errors/UploadTooLargeError';
import { pipeline } from 'stream/promises';
import { UsageField } from '../DB/models/Usage';
import { getLogger } from '../observability/requestContext';

const router = express.Router();

const ALLOWED_VIDEO_CODECS = new Set(['h264', 'hevc', 'vp9', 'av1', 'mpeg4']);

router.post('/', auth, authorizeFeature(['allowedContentTypes.video']), authorizeQuota(new Map([['valuePerContentCount.video', 1]])), async (req, res) => {
    let reqLog = getLogger().child({ module: 'video', route: 'POST /video' });
    try {
        reqLog.debug({ query: req.query }, 'Video upload request received');

        // ------------------------------------------------------------------------- Validating...
        let title: string, fileName: string;
        try {
            title = await string().required().label('Title').validate(req.query.title?.toString());
            fileName = await string().required().label('File name').validate(req.query.fileName?.toString());
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected video upload: invalid metadata');
                return res.status(400).json({ errors: err.errors });
            }
            reqLog.warn({ err }, 'Rejected video upload: invalid metadata');
            return res.status(400).json({ message: 'Invalid Video info.' });
        }
        reqLog.debug({ title, fileName }, 'Validated upload metadata');

        const userId = req.user!.userId;
        reqLog = reqLog.child({ userId });
        const videoRepository = new VideoRepository();

        // ------------------------------------------------------------------------- Checking whether title already exists...
        const existing = await videoRepository.getForUserByTitle(title, userId);
        reqLog.debug({ titleTaken: !!existing }, 'Checked title uniqueness');
        if (existing) {
            reqLog.info({ title }, 'Rejected video upload: title already exists');
            return res.status(400).json({ message: 'Video title must be unique.' });
        }

        // ------------------------------------------------------------------------- Inserting video...
        const videoInsertResult = await videoRepository.insert({
            title,
            fileName,
            userId,
            temporary: true
        });
        reqLog.debug({ insertResult: videoInsertResult }, 'Inserted temporary video record');
        if (!videoInsertResult.acknowledged || !videoInsertResult.insertedId) {
            reqLog.error({ insertResult: videoInsertResult }, 'Video info creation failed');
            return res.status(500).json({ ok: false, message: 'Video info creation failed' });
        }
        const videoId = videoInsertResult.insertedId.toString();
        reqLog = reqLog.child({ videoId });
        reqLog.info('Created temporary video record');

        // ------------------------------------------------------------------------- Set bucket keys
        const videoFileBucketKey = `video/${userId}/${videoId}`;
        const webCompatibleVideoFileBucketKey = `video/${userId}/web/${videoId}`;
        const thumbnailBucketKey = `video/thumbnail/${userId}/${videoId}`;
        reqLog.debug({ videoFileBucketKey, webCompatibleVideoFileBucketKey, thumbnailBucketKey }, 'Computed bucket keys');

        // ------------------------------------------------------------------------- Make the temporary directory
        const jobDir = join(videoUploadTmpDir, videoId)
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
            const videoStream = info.streams.find((s) => s.codec_type === 'video');
            const audioStream = info.streams.find((s) => s.codec_type === 'audio');
            reqLog.debug(
                { videoCodec: videoStream?.codec_name, audioCodec: audioStream?.codec_name, durationRaw: info.format.duration },
                'Probed uploaded file'
            );
            if (!videoStream || !ALLOWED_VIDEO_CODECS.has(videoStream.codec_name)) {
                reqLog.warn({ codec: videoStream?.codec_name }, 'Rejected video upload: unsupported codec');
                throw new InvalidMediaError('Unsupported or unrecognized video format');
            }

            const durationSeconds = info.format.duration ? parseFloat(info.format.duration) : undefined;

            // ------------------------------------------------------------------------- Set file paths
            const webCopyPath = join(jobDir, `${videoId}-web.mp4`);
            const thumbnailPath = join(jobDir, `${videoId}-thumb.jpg`);
            cleanupPaths.push(webCopyPath, thumbnailPath);
            reqLog.debug({ webCopyPath, thumbnailPath, durationSeconds }, 'Resolved output paths');

            // ------------------------------------------------------------------------- Wait for web compatible file and thumbnail to be generated and content type to be collected
            const [, contentType] = await Promise.all([
                generateWebCompatibleCopy(inputPath, jobDir, basename(webCopyPath).split('.')[0], videoStream, audioStream)
                    .then((result) => pipeline(result.outputStream, createWriteStream(webCopyPath!)))
                    .then(() => reqLog.debug('Web-compatible copy written to disk')),
                detectContentType(inputPath).then((ct) => {
                    reqLog.debug({ contentType: ct }, 'Detected content type');
                    return ct;
                }),
                generateThumbnail(inputPath, thumbnailPath, durationSeconds)
                    .then(() => reqLog.debug('Thumbnail generated')),
            ]);
            reqLog.info('Generated web-compatible copy and thumbnail');

            // ------------------------------------------------------------------------- Validate generated file sizes
            const [webCopyStat, thumbnailStat] = await Promise.all([
                stat(webCopyPath),
                stat(thumbnailPath),
            ]);
            const totalStorageBytes = inputSize + webCopyStat.size + thumbnailStat.size;
            reqLog.debug(
                { inputSize, webCopySize: webCopyStat.size, thumbnailSize: thumbnailStat.size, totalStorageBytes },
                'Computed total storage footprint'
            );
            const quota = new Map<UsageField, number>([['storageBytesCount', totalStorageBytes]])
            if (await authorizeQuota(quota, req) !== true) {
                reqLog.info({ totalStorageBytes }, 'Rejected video upload: exceeds plan storage limit');
                throw new UploadTooLargeError('Generated files exceed plan storage limit');
            }
            reqLog.debug('Storage quota authorized');

            try {
                // ------------------------------------------------------------------------- Upload files to the S3 compatible object storage
                reqLog.debug('Uploading files to object storage');
                await Promise.all([
                    uploadToS3(createReadStream(inputPath), videoFileBucketKey, contentType.mimeType),
                    uploadToS3(createReadStream(webCopyPath), webCompatibleVideoFileBucketKey, 'video/mp4'),
                    uploadToS3(createReadStream(thumbnailPath), thumbnailBucketKey, 'image/jpeg'),
                ]);
                reqLog.info(
                    { videoFileBucketKey, webCompatibleVideoFileBucketKey, thumbnailBucketKey, totalStorageBytes },
                    'Uploaded files to object storage'
                );

                // ------------------------------------------------------------------------- Update video info in DB, Make it permanent and set content type
                const updateResult = await videoRepository.unsafeUpdate(videoId, userId, { contentType: contentType, temporary: false, bucketKey: videoFileBucketKey, webBucketKey: webCompatibleVideoFileBucketKey, thumbnailKey: thumbnailBucketKey, thumbnailFileName: basename(thumbnailPath) });
                reqLog.debug({ updateResult }, 'Updated video record');
                if (!updateResult.acknowledged || updateResult.matchedCount !== 1)
                    throw new Error('failed to upload video')

                // Work is durably done — clear reservations so the response-based rollback middleware becomes a no-op for this request no matter what happens to the connection from here on.
                // The connection might drop at this exact moment, which fires the res.on('close') and causes rollbackQuotaOnFailure middleware to rollback although content is properly uploaded and stored(a false alarm).
                req.quotaReservations = []
                reqLog.info({ totalStorageBytes }, 'Video upload finalized');
            } catch (error) {
                reqLog.error({ err: error }, 'Post-upload finalization failed, rolling back stored artifacts');
                rollbackPromises = Promise.allSettled([
                    deleteFromS3(videoFileBucketKey).catch((_) => { }),
                    deleteFromS3(webCompatibleVideoFileBucketKey).catch((_) => { }),
                    deleteFromS3(thumbnailBucketKey).catch((_) => { }),
                    videoRepository.delete(videoId).catch((_) => { })
                ])

                throw error
            }
        } catch (err) {
            if (err instanceof UploadTooLargeError) {
                return res.status(403).json({ error: err.message });
            } else if (err instanceof InvalidMediaError) {
                return res.status(400).json({ error: err.message });
            } else {
                reqLog.error({ err }, 'Video upload failed');
                return res.status(500).json({ error: 'Upload failed' });
            }
        } finally {
            await cleanup();
            if (rollbackPromises !== undefined) {
                await rollbackPromises;
                reqLog.debug('Rollback of stored artifacts completed');
            }
        }

        return res.status(201).json({ id: videoId });
    } catch (err) {
        reqLog.error({ err }, 'Unhandled error in video upload route');
        try { res.status(500).json({ errors: ['Error uploading video file'] }); } catch (_) { }
    }
});

router.get('/info/', auth, async (req, res) => {
    let reqLog = getLogger().child({ module: 'video', route: 'GET /video/info' });
    try {
        reqLog.debug({ query: req.query }, 'Video info request received');

        let videoId: string | undefined = undefined
        let title: string | undefined = undefined
        try {
            videoId = await string().objectIdString().optional().label('Video id').validate(req.query.id?.toString())
            title = await string().optional().label('Title').validate(req.query.title?.toString())

            if (videoId === undefined && title === undefined) {
                reqLog.warn('Rejected video info request: missing id and title');
                res.status(400).json({ message: 'Invalid parameters' });
                return
            }
        } catch (err) {
            reqLog.warn({ err }, 'Rejected video info request: invalid parameters');
            res.status(400).json({ message: 'Invalid parameters' });
            return
        }

        const userId = req.user!.userId
        reqLog = reqLog.child({ userId, videoId, title });
        reqLog.debug('Validated lookup parameters');

        const videoRepository = new VideoRepository()

        let result
        if (videoId)
            result = await videoRepository.getForUser(videoId, userId)
        else
            result = await videoRepository.getForUserByTitle(title!, userId)

        if (!result) {
            reqLog.info('Video not found');
            return res.status(404).send()
        } else {
            reqLog.debug({ videoId: result._id?.toString() }, 'Video found');
        }

        res.status(200).json(result)
    } catch (err) {
        reqLog.error({ err }, 'Failed to get video info');
        res.status(500).json({ message: 'Error getting video' });
    }
});

router.get('/singed_token', auth, async (req, res) => {
    let reqLog = getLogger().child({ module: 'video', route: 'GET /video/singed_token' });
    try {
        reqLog.debug({ query: req.query }, 'Signed token request received');

        let videoId: string | undefined = undefined
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.query.videoId?.toString())
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected signed token request: invalid parameters');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected signed token request: invalid parameters');
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }

        const userId = req.user!.userId
        reqLog = reqLog.child({ userId, videoId });

        const videoRepository = new VideoRepository()

        const video = await videoRepository.getForUser(videoId, userId)
        if (!video) {
            reqLog.info('Video not found');
            return res.status(404).json({ message: 'Video not found' });
        }
        reqLog.debug('Video ownership confirmed');

        const token = generateStreamToken(videoId, userId);
        reqLog.info('Issued signed stream token');

        return res.status(200).json({ token });
    } catch (err) {
        reqLog.error({ err }, 'Failed to issue signed token');
        res.status(500).json({ message: 'Error getting video file' });
    }
});

// For non web clients
router.get('/file/:videoId', auth, async (req, res) => {
    let reqLog = getLogger().child({ module: 'video', route: 'GET /video/file/:videoId' });
    try {
        reqLog.debug({ params: req.params, range: req.headers.range }, 'Video file request received');

        let videoId: string | undefined = undefined
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId?.toString())
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected video file request: invalid parameters');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected video file request: invalid parameters');
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }
        reqLog = reqLog.child({ userId: req.user!.userId, videoId });

        await streamVideoFile(videoId, req.user!.userId, req, res, false, reqLog)
    } catch (err) {
        reqLog.error({ err }, 'Failed to stream video file');
        res.status(500).json({ message: 'Error getting video file' });
    }
});

// For web clients
router.get('/file/:token/:videoId', async (req, res) => {
    let reqLog = getLogger().child({ module: 'video', route: 'GET /video/file/:token/:videoId' });
    try {
        reqLog.debug({ params: { videoId: req.params.videoId }, range: req.headers.range }, 'Web video file request received');

        let videoId: string | undefined = undefined, token: string | undefined = undefined
        try {
            token = await string().required().label('Token').validate(req.params.token?.toString())
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId?.toString())
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected web video file request: invalid parameters');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected web video file request: invalid parameters');
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }
        reqLog = reqLog.child({ videoId });

        const { valid, userId } = verifyStreamToken(token, videoId);
        reqLog.debug({ valid }, 'Verified stream token');
        if (valid !== true || !userId) {
            reqLog.warn('Rejected web video file request: invalid or expired token');
            return res.status(401).send();
        }
        reqLog = reqLog.child({ userId });

        await streamVideoFile(videoId, userId, req, res, true, reqLog)
    } catch (err) {
        reqLog.error({ err }, 'Failed to stream web video file');
        res.status(500).json({ message: 'Error getting video file' });
    }
});

async function streamVideoFile(videoId: string, userId: string, req: Request, res: Response, isWeb: boolean, reqLog = getLogger().child({ module: 'video' })) {
    const videoRepository = new VideoRepository()

    const video = await videoRepository.getForUser(videoId, userId!)
    if (!video || (isWeb && !video.webBucketKey) || (!isWeb && !video.bucketKey)) {
        reqLog.info({ hasVideo: !!video, isWeb }, 'Video not found or missing expected bucket key');
        return res.status(404).json({ message: 'Video not found' });
    }

    const range = req.headers.range;
    const key = isWeb ? video.webBucketKey : video.bucketKey;
    reqLog.debug({ key, range }, 'Fetching object from storage');

    const result = await s3.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Range: range
    }));
    reqLog.debug({ key, range, contentLength: result.ContentLength, contentRange: result.ContentRange }, 'Fetched object from storage');

    if (result.Body === undefined || result.Body === null) {
        reqLog.warn({ key }, 'Storage object has no body');
        return res.status(404).send();
    }

    const body = result.Body as Readable;
    body.on('error', (err) => {
        reqLog.error({ err, key }, 'S3 stream error while serving video file');
        if (!res.headersSent) res.status(500).end();
        else res.destroy();
    });

    res.status(range ? 206 : 200);
    res.setHeader('Content-Type', isWeb ? 'video/mp4' : (video.contentType?.mimeType ?? 'video/mp4'));
    res.setHeader('Accept-Ranges', 'bytes');
    if (result.ContentRange) res.setHeader('Content-Range', result.ContentRange);
    if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength);

    reqLog.info({ key, range, statusCode: range ? 206 : 200 }, 'Streaming video file to client');
    body.pipe(res)
}

router.get('/thumbnail/:videoId', auth, async (req, res) => {
    let reqLog = getLogger().child({ module: 'video', route: 'GET /video/thumbnail/:videoId' });
    try {
        reqLog.debug({ params: req.params, query: req.query }, 'Thumbnail request received');

        let videoId: string | undefined = undefined, download: boolean = false
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId?.toString())
            let temp = await string().optional().label('Download').validate(req.query.download?.toString())
            download = temp === 'true';
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected thumbnail request: invalid parameters');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected thumbnail request: invalid parameters');
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        reqLog = reqLog.child({ userId: req.user!.userId, videoId, download });

        const userId = req.user!.userId

        const videoRepository = new VideoRepository()

        const video = await videoRepository.getForUser(videoId, userId)
        if (!video) {
            reqLog.info('Video not found');
            return res.status(404).json({ message: 'Video not found' });
        }
        if (!video || !video.thumbnailKey || !video.thumbnailFileName) {
            reqLog.info('Video has no thumbnail');
            return res.status(404).json({ message: 'Video thumbnail not found' });
        }
        reqLog.debug({ thumbnailKey: video.thumbnailKey }, 'Fetching thumbnail from storage');

        const result = await s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: video.thumbnailKey,
            ResponseContentDisposition: download ? `attachment; filename="${video.thumbnailFileName}"` : undefined,
        }));
        reqLog.debug({ key: video.thumbnailKey, contentLength: result.ContentLength, contentType: result.ContentType }, 'Fetched thumbnail from storage');

        const stream = result.Body as any;
        if (stream === undefined || stream === null) {
            reqLog.warn({ key: video.thumbnailKey }, 'Thumbnail object has no body');
            return res.status(404).send();
        }

        const contentLength = result.ContentLength;

        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Type", result.ContentType || "application/octet-stream");

        res.status(200);
        res.setHeader("Content-Length", contentLength ?? "");

        reqLog.info({ key: video.thumbnailKey, download }, 'Streaming thumbnail to client');
        (stream as any).pipe(res);
    } catch (err) {
        reqLog.error({ err }, 'Failed to get thumbnail');
        res.status(500).json({ message: 'Error getting video file' });
    }
});

router.delete('/:videoId', auth, async (req, res) => {
    let reqLog = getLogger().child({ module: 'video', route: 'DELETE /video/:videoId' });
    try {
        reqLog.debug({ params: req.params }, 'Video delete request received');

        let videoId: string | undefined = undefined
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId?.toString())
        } catch (err) {
            if (err instanceof ValidationError) {
                reqLog.warn({ errors: err.errors }, 'Rejected video delete request: invalid parameters');
                return res.status(400).json({ errors: err.errors })
            }
            reqLog.warn({ err }, 'Rejected video delete request: invalid parameters');
            return res.status(400).json({ message: 'Invalid Tree node' });
        }

        const userId = req.user!.userId
        reqLog = reqLog.child({ userId, videoId });

        const videoRepository = new VideoRepository()

        const video = await videoRepository.getForUser(videoId, userId)
        if (!video) {
            reqLog.info('Video not found');
            res.status(404).json({ message: 'Video not found' });
            return
        }
        reqLog.debug({ bucketKey: video.bucketKey, thumbnailKey: video.thumbnailKey }, 'Video found, starting delete');

        const r = await videoRepository.unsafeUpdate(videoId, userId, { temporary: true })
        reqLog.debug({ updateResult: r }, 'Marked video temporary in DB before delete');
        if (!r.acknowledged || r.matchedCount) {
            reqLog.error({ updateResult: r }, 'Failed to mark video temporary before delete');
            return res.status(500).send()
        }

        await s3.send(
            new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: video.bucketKey
            })
        );
        reqLog.debug({ key: video.bucketKey }, 'Deleted video file from storage');

        if (video?.thumbnailKey) {
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: video.thumbnailKey
                })
            );
            reqLog.debug({ key: video.thumbnailKey }, 'Deleted thumbnail from storage');
        }

        const rr = await videoRepository.delete(videoId)
        reqLog.debug({ deleteResult: rr }, 'Deleted video record from DB');
        if (!rr.acknowledged) {
            reqLog.error({ deleteResult: rr }, 'Failed to delete video record from DB');
            return res.status(500).send()
        }

        reqLog.info('Video deleted');
        res.status(200).send();
    } catch (err) {
        reqLog.error({ err }, 'Failed to delete video');
        res.status(500).json({ message: 'Error deleting video' });
    }
});

export { router as videoRoutes };
