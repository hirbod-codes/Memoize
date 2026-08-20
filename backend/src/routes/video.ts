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
import { authorizeFeature, authorizeQuota, rollbackQuota } from '../middlewares/authorization';
import { mkdir, rm, stat, unlink } from 'fs/promises';
import { deleteFromS3, detectContentType, receiveUpload, uploadToS3 } from '../lib/file_management';
import { InvalidMediaError } from '../errors/InvalidMediaError';
import { UploadTooLargeError } from '../errors/UploadTooLargeError';
import { pipeline } from 'stream/promises';
import { UsageField } from '../DB/models/Usage';

const router = express.Router();

const ALLOWED_VIDEO_CODECS = new Set(['h264', 'hevc', 'vp9', 'av1', 'mpeg4']);

router.post('/', auth, authorizeFeature(['allowedContentTypes.video']), authorizeQuota(new Map([['valuePerContentCount.video', 1]])), async (req, res) => {
    try {
        console.log('/api/video/', 'POST');

        console.log('Validating...');
        // ------------------------------------------------------------------------- Validating...
        let title: string, fileName: string;
        try {
            title = await string().required().label('Title').validate(req.query.title?.toString());
            fileName = await string().required().label('File name').validate(req.query.fileName?.toString());
            console.log({ title, fileName });
        } catch (err) {
            console.error(err);
            if (err instanceof ValidationError) {
                return res.status(400).json({ errors: err.errors });
            }
            return res.status(400).json({ message: 'Invalid Video info.' });
        }

        const userId = req.user!.userId;
        const videoRepository = new VideoRepository();

        console.log("Checking whether title already exists...");
        // ------------------------------------------------------------------------- Checking whether title already exists...
        const existing = await videoRepository.getForUserByTitle(title, userId);
        if (existing) {
            return res.status(400).json({ message: 'Video title must be unique.' });
        }

        console.log("Inserting video...");
        // ------------------------------------------------------------------------- Inserting video...
        const videoInsertResult = await videoRepository.insert({
            title,
            fileName,
            userId,
            temporary: true
        });
        console.log("Video insert result", videoInsertResult);
        if (!videoInsertResult.acknowledged || !videoInsertResult.insertedId) {
            return res.status(500).json({ ok: false, message: 'Video info creation failed' });
        }
        const videoId = videoInsertResult.insertedId.toString();

        // ------------------------------------------------------------------------- Set bucket keys
        const videoFileBucketKey = `video/${userId}/${videoId}`;
        const webCompatibleVideoFileBucketKey = `video/${userId}/web/${videoId}`;
        const thumbnailBucketKey = `video/thumbnail/${userId}/${videoId}`;

        // ------------------------------------------------------------------------- Make the temporary directory
        const jobDir = join(videoUploadTmpDir, videoId)
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
            const videoStream = info.streams.find((s) => s.codec_type === 'video');
            const audioStream = info.streams.find((s) => s.codec_type === 'audio');
            if (!videoStream || !ALLOWED_VIDEO_CODECS.has(videoStream.codec_name))
                throw new InvalidMediaError('Unsupported or unrecognized video format');

            const durationSeconds = info.format.duration ? parseFloat(info.format.duration) : undefined;

            // ------------------------------------------------------------------------- Set file paths
            const webCopyPath = join(jobDir, `${videoId}-web.mp4`);
            const thumbnailPath = join(jobDir, `${videoId}-thumb.jpg`);
            cleanupPaths.push(webCopyPath, thumbnailPath);

            // ------------------------------------------------------------------------- Wait for web compatible file and thumbnail to be generated and content type to be collected
            const [_, contentType] = await Promise.all([
                generateWebCompatibleCopy(inputPath, jobDir, basename(webCopyPath).split('.')[0], videoStream, audioStream).then((result) => pipeline(result.outputStream, createWriteStream(webCopyPath!))),
                detectContentType(inputPath),
                generateThumbnail(inputPath, thumbnailPath, durationSeconds),
            ]);

            // ------------------------------------------------------------------------- Validate generated file sizes
            const [webCopyStat, thumbnailStat] = await Promise.all([
                stat(webCopyPath),
                stat(thumbnailPath),
            ]);
            const totalStorageBytes = inputSize + webCopyStat.size + thumbnailStat.size;
            const quota = new Map<UsageField, number>([['storageBytesCount', totalStorageBytes]])
            if (await authorizeQuota(quota, req) !== true)
                throw new UploadTooLargeError('Generated files exceed plan storage limit');

            try {
                // ------------------------------------------------------------------------- Upload files to the S3 compatible object storage
                await Promise.all([
                    uploadToS3(createReadStream(inputPath), videoFileBucketKey, contentType.mimeType),
                    uploadToS3(createReadStream(webCopyPath), webCompatibleVideoFileBucketKey, 'video/mp4'),
                    uploadToS3(createReadStream(thumbnailPath), thumbnailBucketKey, 'image/jpeg'),
                ]);

                // ------------------------------------------------------------------------- Update video info in DB, Make it permanent and set content type
                const updateResult = await videoRepository.unsafeUpdate(videoId, userId, { contentType: contentType, temporary: false, bucketKey: videoFileBucketKey, webBucketKey: webCompatibleVideoFileBucketKey, thumbnailKey: thumbnailBucketKey, thumbnailFileName: basename(thumbnailPath) });
                if (!updateResult.acknowledged || updateResult.matchedCount !== 1)
                    throw new Error('failed to upload video')

                // Work is durably done — clear reservations so the response-based rollback middleware becomes a no-op for this request no matter what happens to the connection from here on.
                // The connection might drop at this exact moment, which fires the res.on('close') and causes rollbackQuotaOnFailure middleware to rollback although content is properly uploaded and stored(a false alarm).
                req.quotaReservations = []
            } catch (error) {
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
                console.error('Video upload failed:', err);
                return res.status(500).json({ error: 'Upload failed' });
            }
        } finally {
            await cleanup();
            if (rollbackPromises !== undefined) await rollbackPromises
        }

        return res.status(201).json({ id: videoId });
    } catch (err) {
        console.error(err)
        try { res.status(500).json({ errors: ['Error uploading video file'] }); } catch (_) { }
    } finally {
        console.log('------------end------------')
    }
});

router.get('/info/', auth, async (req, res) => {
    try {
        console.log('/api/video/info')

        console.log('Validation...')
        let videoId: string | undefined = undefined
        let title: string | undefined = undefined
        try {
            videoId = await string().objectIdString().optional().label('Video id').validate(req.query.id?.toString())
            title = await string().optional().label('Title').validate(req.query.title?.toString())

            if (videoId === undefined && title === undefined) {
                res.status(400).json({ message: 'Invalid parameters' });
                return
            }
        } catch (err) {
            console.error(err)
            res.status(400).json({ message: 'Invalid parameters' });
            return
        }
        console.log({ videoId, title })

        const userId = req.user!.userId

        const videoRepository = new VideoRepository()

        let result
        if (videoId)
            result = await videoRepository.getForUser(videoId, userId)
        else
            result = await videoRepository.getForUserByTitle(title!, userId)

        console.log({ result })

        res.status(200).json(result)

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting video' });
    }
});

router.get('/singed_token', auth, async (req, res) => {
    try {
        console.log('/api/video/singed_token')

        console.log('Validation...')
        let videoId: string | undefined = undefined
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.query.videoId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }
        console.log({ videoId })

        const userId = req.user!.userId

        const videoRepository = new VideoRepository()

        console.log("Checking weather video exists...");
        const video = await videoRepository.getForUser(videoId, userId)
        if (!video)
            return res.status(404).json({ message: 'Video not found' });
        console.log({ video })

        const token = generateStreamToken(videoId, userId);

        return res.status(200).json({ token });
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Error getting video file' });
    } finally {
        console.log('------------end------------')
    }
});

// For non web clients
router.get('/file/:videoId', auth, async (req, res) => {
    try {
        console.log('/api/video/file/:videoId')

        console.log('Validation...')
        let videoId: string | undefined = undefined
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }
        console.log({ videoId })

        await streamVideoFile(videoId, req.user!.userId, req, res, true)
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Error getting video file' });
    } finally {
        console.log('------------end------------')
    }
});

// For web clients
router.get('/file/:token/:videoId', async (req, res) => {
    try {
        console.log('/api/video/file/:token/:videoId')

        console.log('Validation...')
        let videoId: string | undefined = undefined, token: string | undefined = undefined
        try {
            token = await string().required().label('Token').validate(req.params.token?.toString())
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }
        console.log({ videoId })

        console.log('Verifying token...')
        const { valid, userId } = verifyStreamToken(token, videoId);
        if (valid !== true || !userId)
            return res.status(401).send();

        await streamVideoFile(videoId, userId, req, res, true)
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Error getting video file' });
    } finally {
        console.log('------------end------------')
    }
});

async function streamVideoFile(videoId: string, userId: string, req: Request, res: Response, isWeb: boolean) {
    const videoRepository = new VideoRepository()

    console.log("Checking weather video exists...");
    const video = await videoRepository.getForUser(videoId, userId!)
    if (!video || (isWeb && !video.webBucketKey) || (!isWeb && !video.bucketKey))
        return res.status(404).json({ message: 'Video not found' });
    console.log({ video })

    const range = req.headers.range;

    const result = await s3.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: isWeb ? video.webBucketKey : video.bucketKey,
        Range: range
    }));
    console.log({ result, key: video.bucketKey })

    if (result.Body === undefined || result.Body === null)
        return res.status(404).send();

    const body = result.Body as Readable;
    body.on('error', (err) => {
        console.error('S3 stream error:', err);
        if (!res.headersSent) res.status(500).end();
        else res.destroy();
    });

    res.status(range ? 206 : 200);
    res.setHeader('Content-Type', isWeb ? 'video/mp4' : (video.contentType?.mimeType ?? 'video/mp4'));
    res.setHeader('Accept-Ranges', 'bytes');
    if (result.ContentRange) res.setHeader('Content-Range', result.ContentRange);
    if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength);

    body.pipe(res)
}

router.get('/thumbnail/:videoId', auth, async (req, res) => {
    try {
        console.log('/api/video/thumbnail')

        console.log('Validation...')
        let videoId: string | undefined = undefined, download: boolean = false
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId?.toString())
            let temp = await string().optional().label('Download').validate(req.query.download?.toString())
            download = temp === 'true';
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        console.log({ videoId })

        const userId = req.user!.userId

        const videoRepository = new VideoRepository()

        console.log("Checking weather video exists...");
        const video = await videoRepository.getForUser(videoId, userId)
        console.log({ video })
        if (!video)
            return res.status(404).json({ message: 'Video not found' });
        if (!video || !video.thumbnailKey || !video.thumbnailFileName)
            return res.status(404).json({ message: 'Video thumbnail not found' });

        const result = await s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: video.thumbnailKey,
            ResponseContentDisposition: download ? `attachment; filename="${video.thumbnailFileName}"` : undefined,
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
        res.status(500).json({ message: 'Error getting video file' });
    } finally {
        console.log('------------end------------')
    }
});

router.delete('/:videoId', auth, async (req, res) => {
    try {
        console.log('/api/video', 'DELETE')

        console.log('Validation...')
        let videoId: string | undefined = undefined
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ videoId })

        const userId = req.user!.userId

        const videoRepository = new VideoRepository()

        console.log("Checking weather video exists...");
        const video = await videoRepository.getForUser(videoId, userId)
        if (!video) {
            res.status(404).json({ message: 'Video not found' });
            return
        }
        console.log({ video })

        console.log("Make video temporary in DB to maintain consistency...");
        const r = await videoRepository.unsafeUpdate(videoId, userId, { temporary: true })
        if (!r.acknowledged || r.matchedCount)
            return res.status(500).send()

        console.log("Deleting video file in the bucket storage...");
        await s3.send(
            new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: video.bucketKey
            })
        );

        if (video?.thumbnailKey) {
            console.log("Deleting video file thumbnail in the bucket storage...");
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: video.thumbnailKey
                })
            );
        }

        console.log("Deleting video in DB...");
        const rr = await videoRepository.delete(videoId)
        if (!rr.acknowledged)
            return res.status(500).send()

        res.status(200).send();
    } catch (err) {
        res.status(500).json({ message: 'Error deleting video' });
    } finally {
        console.log('------------end------------')
    }
});

export { router as videoRoutes };