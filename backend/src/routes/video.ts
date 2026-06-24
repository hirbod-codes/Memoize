import express from 'express';
import { string, ValidationError } from 'yup';
import { auth, authorization } from '../middlewares/auth';
import { s3 } from '..';
import { Upload } from "@aws-sdk/lib-storage";
import VideoRepository from '../DB/repositories/VideoRepository';
import { fileTypeFromBuffer } from "file-type";
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import ffprobe from "ffprobe-static";
import ffmpeg from "fluent-ffmpeg";
import fs from 'fs'
import { promises as fsp } from "fs";
import path from 'path'
import { teeStream } from '../lib/stream';
import { decodeVideoStreamToRamSegments } from '../ffmpeg';

const router = express.Router();

ffmpeg.setFfprobePath(ffprobe.path);

router.post('/', auth, authorization, async (req, res) => {
    try {
        console.log('/api/video/', 'POST');
        console.log('Validating...');

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

        const userId = (req as any).user.userId;
        const videoRepository = new VideoRepository();

        console.log("Checking whether title already exists...");
        const existing = await videoRepository.getForUserByTitle(title, userId);
        if (existing) {
            return res.status(400).json({ message: 'Video title must be unique.' });
        }

        const videoFileBucketKey = `video/${userId}/${title}`;
        const thumbnailBucketKey = `video/thumbnail/${userId}/${title}`;
        const playlistBucketKey = `${videoFileBucketKey}/index.m3u8`;

        console.log("Inserting video...");
        const videoInsertResult = await videoRepository.insert({
            title,
            fileName,
            contentType: "application/octet-stream",
            userId,
            bucketKey: videoFileBucketKey,
            temporary: true
        });
        console.log("Video insert result", videoInsertResult);
        if (!videoInsertResult.acknowledged || !videoInsertResult.insertedId) {
            return res.status(500).json({ ok: false, message: 'Video info creation failed' });
        }
        const videoId = videoInsertResult.insertedId.toString();

        console.log("Splitting req stream...");
        let playlistUpload: Upload | null = null;
        let uploadThumbnail: Upload | null = null;
        let thumbnailFile: string | null = null;

        const { splitter, createBranch } = teeStream();
        const s3Stream = createBranch();
        const metadataStream = createBranch();
        const typeStream = createBranch();
        const ffmpegStream = createBranch();

        const swallow = <T>(p: Promise<T>) => { p.catch(() => { }); return p; };

        const segmentUploads: Upload[] = [];
        const segmentUploadPromises: Promise<any>[] = [];

        try {
            req.on('error', (err) => {
                console.error('Request stream error:', err);
                splitter.destroy(err);
            });
            req.pipe(splitter);
            splitter.resume();

            console.log("Uploading video file...");

            const uploadPromise = swallow((async () => {
                await decodeVideoStreamToRamSegments({
                    title,
                    input: s3Stream,
                    maxFileSize: 0,
                    onSegment: ({ filename, index, stream }) => {
                        const segmentKey = `${videoFileBucketKey}/${filename}`;
                        const upload = new Upload({
                            client: s3,
                            params: {
                                Bucket: "memoize",
                                Key: segmentKey,
                                Body: stream,
                                ContentType: "video/mp2t",
                            },
                        });
                        segmentUploads.push(upload);
                        segmentUploadPromises.push(
                            upload.done().catch((err) => {
                                console.error(`Failed to upload segment ${filename}:`, err);
                                throw err;
                            })
                        );
                    },
                    onPlaylist: (m3u8Contents, isFinal) => {
                        const upload = new Upload({
                            client: s3,
                            params: {
                                Bucket: "memoize",
                                Key: playlistBucketKey,
                                Body: m3u8Contents,
                                ContentType: "application/vnd.apple.mpegurl",
                            },
                        });
                        playlistUpload = upload;
                        segmentUploadPromises.push(
                            upload.done().catch((err) => {
                                console.error(`Failed to upload playlist (final=${isFinal}):`, err);
                                throw err;
                            })
                        );
                    },
                });
                // Wait for every segment + playlist S3 write to finish too,
                // not just ffmpeg's own completion.
                await Promise.all(segmentUploadPromises);
            })());

            console.log("Extracting video file metadata...");
            const metadataPromise: Promise<ffmpeg.FfprobeData> = swallow(new Promise((resolve, reject) => {
                ffmpeg(metadataStream).ffprobe((err, data) => {
                    if (err) return reject(err);
                    resolve(data);
                });
            }));

            console.log("Extracting video file content type...");
            const contentTypePromise: Promise<string> = swallow((async () => {
                const chunks: Buffer[] = [];
                let total = 0;
                const maxBytes = 8192;
                try {
                    for await (const chunk of typeStream) {
                        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                        chunks.push(buffer);
                        total += buffer.length;
                        if (total >= maxBytes) break;
                    }
                } finally {
                    if (!typeStream.destroyed) typeStream.destroy();
                }
                const head = Buffer.concat(chunks, total);
                const result = await fileTypeFromBuffer(head);
                return result?.mime ?? "application/octet-stream";
            })());

            console.log("Generating video file thumbnail...");
            const thumbnailFileDirectory = path.join('tmp', userId);
            await fsp.mkdir(thumbnailFileDirectory, { recursive: true });
            const thumbnailFileName = `${title}_${Date.now()}.jpg`;
            const outputPath = path.join(thumbnailFileDirectory, thumbnailFileName);
            console.log({ outputPath });

            const thumbnailPromise: Promise<string> = swallow(new Promise((resolve, reject) => {
                ffmpeg(ffmpegStream).screenshots({ count: 1, folder: thumbnailFileDirectory, filename: thumbnailFileName, size: "320x240" })
                    .on("end", () => resolve(outputPath))
                    .on("error", reject);
            }));

            console.log("Waiting for streams to finish...");
            const [, metadata, contentType, thumbnailResult] = await Promise.all([
                uploadPromise,
                metadataPromise,
                contentTypePromise,
                thumbnailPromise,
            ]);
            thumbnailFile = thumbnailResult;
            console.log({ metadata, contentType, thumbnailFile });

            console.log("Uploading thumbnail...");
            uploadThumbnail = new Upload({
                client: s3,
                params: {
                    Bucket: "memoize",
                    Key: thumbnailBucketKey,
                    Body: fs.createReadStream(thumbnailFile)
                }
            });
            await uploadThumbnail.done();

            const updateResult = await videoRepository.unsafeUpdate(videoId, userId, { contentType, temporary: false, thumbnailKey: thumbnailBucketKey, thumbnailFileName: thumbnailFile });

            if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
                return res.status(500).json({ ok: false, message: 'Video info update failed' });
            }

            return res.status(201).json({ id: videoId });
        } catch (err) {
            console.error(err);

            splitter.destroy();

            try {
                await Promise.all(segmentUploads.map((u) => u.abort().catch(() => { })));
                await (playlistUpload as Upload | null)?.abort();
            } catch (abortErr) { console.error('Failed to abort segment/playlist uploads:', abortErr); }

            try {
                await uploadThumbnail?.abort();
            } catch (abortErr) { console.error('Failed to abort cover art upload:', abortErr); }

            return res.status(500).json({ message: 'Error uploading video file' });
        } finally {
            if (thumbnailFile) {
                fsp.unlink(thumbnailFile).catch((unlinkErr) => {
                    console.error('Failed to remove temp thumbnail file:', unlinkErr);
                });
            }
            console.log('------------end------------');
        }
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Error uploading video file' });
    }
});

router.get('/info/', auth, async (req, res) => {
    try {
        console.log('/api/video/info')

        console.log('Validation...')
        let videoId: string | undefined = undefined
        let title: string | undefined = undefined
        try {
            videoId = await string().objectIdString().optional().label('Video id').validate(req.query.videoId?.toString())
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

        const userId = (req as any).user.userId

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

router.get('/file/:videoId', auth, async (req, res) => {
    try {
        console.log('/api/video/file')

        console.log('Validation...')
        let videoId: string | undefined = undefined
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        console.log({ videoId })

        const userId = (req as any).user.userId

        const videoRepository = new VideoRepository()

        console.log("Checking weather video exists...");
        const video = await videoRepository.getForUser(videoId, userId)
        if (!video) {
            res.status(404).json({ message: 'Video not found' });
            return
        }
        console.log({ video })

        const result = await s3.send(new GetObjectCommand({
            Bucket: "memoize",
            Key: video.bucketKey,
        }));

        const stream = result.Body as any;

        const contentLength = result.ContentLength;

        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Type", result.ContentType || "application/octet-stream");

        res.status(200);
        res.setHeader("Content-Length", contentLength ?? "");

        stream.pipe(res);

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting video file' });
    }
});

router.get('/thumbnail/:videoId', auth, async (req, res) => {
    try {
        console.log('/api/video/thumbnail')

        console.log('Validation...')
        let videoId: string | undefined = undefined, download: boolean = false
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId?.toString())
            let temp = await string().optional().label('Download').validate(req.params.download?.toString())
            download = temp === 'true';
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        console.log({ videoId })

        const userId = (req as any).user.userId

        const videoRepository = new VideoRepository()

        console.log("Checking weather video exists...");
        const video = await videoRepository.getForUser(videoId, userId)
        if (!video || !video.thumbnailKey || !video.thumbnailFileName) {
            res.status(404).json({ message: 'Video not found' });
            return
        }
        console.log({ video })

        const result = await s3.send(new GetObjectCommand({
            Bucket: "memoize",
            Key: video.thumbnailKey,
            ResponseContentDisposition: download ? `attachment; filename="${video.thumbnailFileName}"` : undefined,
        }));

        (result.Body as any).pipe(res)
        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting video file' });
    }
});

router.delete('/:videoId', auth, authorization, async (req, res) => {
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

        const userId = (req as any).user.userId

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
                Bucket: "memoize",
                Key: video.bucketKey
            })
        );

        if (video?.thumbnailKey) {
            console.log("Deleting video file thumbnail in the bucket storage...");
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: "memoize",
                    Key: video.thumbnailKey
                })
            );
        }

        console.log("Deleting video in DB...");
        const rr = await videoRepository.delete(videoId)
        if (!rr.acknowledged)
            return res.status(500).send()

        res.status(200).send();

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error deleting video' });
    }
});

export { router as videoRoutes };