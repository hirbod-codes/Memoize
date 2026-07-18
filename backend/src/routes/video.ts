import express from 'express';
import { string, ValidationError } from 'yup';
import { auth, authorization } from '../middlewares/auth';
import { BUCKET_NAME, ffmpeg, s3 } from '..';
import { Upload } from "@aws-sdk/lib-storage";
import VideoRepository from '../DB/repositories/VideoRepository';
import { fileTypeFromBuffer } from "file-type";
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs'
import { promises as fsp } from "fs";
import path from 'path'
import { teeStream } from '../lib/stream';
import { decodeVideoFileToRamSegments, prepareVideoInputOnRam } from '../ffmpeg';
import { MaxFileSizeExceededError } from '../errors/MaxFileSizeExceededError';
import { MinFileSizeNotMetError } from '../errors/MinFileSizeNotMetError';
import { Readable } from 'stream';
import { generateStreamToken, verifyStreamToken } from '../lib/signed_urls';

const router = express.Router();

router.post('/', auth, authorization, async (req, res) => {
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

        const userId = (req as any).user.userId;
        const videoRepository = new VideoRepository();

        console.log("Checking whether title already exists...");
        // ------------------------------------------------------------------------- Checking whether title already exists...
        const existing = await videoRepository.getForUserByTitle(title, userId);
        if (existing) {
            return res.status(400).json({ message: 'Video title must be unique.' });
        }

        const videoFileBucketKey = `video/${userId}/${title}`;
        const playlistBucketKey = `${videoFileBucketKey}/index.m3u8`;
        const thumbnailBucketKey = `video/thumbnail/${userId}/${title}`;

        console.log("Inserting video...");
        // ------------------------------------------------------------------------- Inserting video...
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
        // ------------------------------------------------------------------------- Splitting req stream...
        const { splitter, createBranch } = teeStream();
        const metadataStream = createBranch();

        const swallow = <T>(p: Promise<T>) => { p.catch((e) => { console.error('swallow throws an error.', e); }); return p; };

        const segmentUploads: Upload[] = [];
        const segmentUploadPromises: Promise<any>[] = [];

        let playlistUpload: Upload | null = null;
        let uploadThumbnail: Upload | null = null;
        let thumbnailFile: string | null = null;

        let minFileSize = 5 * 1024
        let maxFileSize = 2 * 1024 * 1024 * 1024

        const { inputFilePath: filePath, jobDir: directory, cleanup } = await prepareVideoInputOnRam({
            input: req,
            minFileSize,
            maxFileSize,
            title,
        });

        try {
            console.log("Uploading video file...");
            // ------------------------------------------------------------------------- Uploading video file...
            const uploadPromise = swallow((async () => {
                await decodeVideoFileToRamSegments({
                    inputFilePath: filePath,
                    jobDir: directory,
                    onSegment: ({ filename, stream }) => {
                        const segmentKey = `${videoFileBucketKey}/${filename}`;
                        const upload = new Upload({
                            client: s3,
                            params: {
                                Bucket: BUCKET_NAME,
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
                        if (!isFinal) return;
                        const upload = new Upload({
                            client: s3,
                            params: {
                                Bucket: BUCKET_NAME,
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
            // ------------------------------------------------------------------------- Extracting video file metadata...
            const metadataPromise: Promise<ffmpeg.FfprobeData> = swallow((async () => {
                try {
                    return await new Promise((resolve, reject) => {
                        ffmpeg(filePath).ffprobe((err, data) => {
                            if (err) return reject(err);
                            resolve(data);
                        });
                    })
                } finally {
                    if (!metadataStream.destroyed) metadataStream.destroy()
                }
            })());

            console.log("Extracting video file content type...");
            // ------------------------------------------------------------------------- Extracting video file content type...
            const contentTypePromise: Promise<string> = swallow((async () => {
                const fd = await fsp.open(filePath, "r");
                try {
                    const { buffer, bytesRead } = await fd.read(Buffer.alloc(8192), 0, 8192, 0);
                    const result = await fileTypeFromBuffer(buffer.subarray(0, bytesRead));
                    return result?.mime ?? "application/octet-stream";
                } finally {
                    await fd.close();
                }
            })());

            console.log("Generating video file thumbnail...");
            // ------------------------------------------------------------------------- Generating video file thumbnail...
            const thumbnailFileDirectory = path.join('tmp', userId);
            await fsp.mkdir(thumbnailFileDirectory, { recursive: true });

            const thumbnailFileName = `${title}_${Date.now()}.jpg`;
            const outputPath = path.join(thumbnailFileDirectory, thumbnailFileName);
            console.log({ outputPath });

            const thumbnailPromise: Promise<string> = swallow((async () => {
                try {
                    return await new Promise((resolve, reject) => {
                        ffmpeg(filePath).screenshots({ count: 1, folder: thumbnailFileDirectory, filename: thumbnailFileName, size: "320x240", timestamps: ['1'] })
                            .on("end", () => resolve(outputPath))
                            .on("error", reject);
                    })
                } finally {
                    if (!metadataStream.destroyed) metadataStream.destroy()
                }
            })());

            console.log("Waiting for streams to finish...");
            // ------------------------------------------------------------------------- Waiting for streams to finish...
            const [, metadata, contentType, thumbnailResult] = await Promise.all([
                uploadPromise,
                metadataPromise,
                contentTypePromise,
                thumbnailPromise,
            ]);

            console.log({ metadata, contentType, thumbnailResult });

            console.log("Uploading thumbnail...");
            uploadThumbnail = new Upload({
                client: s3,
                params: {
                    Bucket: BUCKET_NAME,
                    Key: thumbnailBucketKey,
                    Body: fs.createReadStream(thumbnailResult)
                }
            });
            await uploadThumbnail.done();

            const updateResult = await videoRepository.unsafeUpdate(videoId, userId, { contentType, temporary: false, thumbnailKey: thumbnailBucketKey, thumbnailFileName });

            if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
                return res.status(500).json({ ok: false, message: 'Video info update failed' });
            }
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

            if (err instanceof MaxFileSizeExceededError) {
                return res.status(413).json({ errors: [err.message] });
            }
            if (err instanceof MinFileSizeNotMetError) {
                return res.status(400).json({ errors: [err.message] });
            }

            return res.status(500).json({ errors: ['Error uploading video file'] });
        } finally {
            if (thumbnailFile) {
                fsp.unlink(thumbnailFile).catch((unlinkErr) => {
                    console.error('Failed to remove temp thumbnail file:', unlinkErr);
                });
            }

            await cleanup();
        }

        return res.status(201).json({ id: videoId });
    } catch (err) {
        console.error(err)
        res.status(500).json({ errors: ['Error uploading video file'] });
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

        const userId = (req as any).user.userId

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

// For non web applications
router.get('/file/:videoId/:filename', auth, async (req, res) => {
    try {
        console.log('/api/video/file/:videoId/:filename')

        console.log('Validation...')
        let videoId: string | undefined = undefined, filename: string | undefined = undefined, isPlaylist
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId?.toString())
            filename = await string().required().label('File name').validate(req.params.filename?.toString())

            isPlaylist = filename === "index.m3u8";
            const isSegment = /^segment_\d+\.ts$/.test(filename);
            if (!isPlaylist && !isSegment) {
                return res.status(400).json({ errors: ['Invalid file names requested'] });
            }
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }
        console.log({ videoId })

        const videoRepository = new VideoRepository()

        const userId = (req as any).user.userId

        console.log("Checking weather video exists...");
        const video = await videoRepository.getForUser(videoId, userId!)
        if (!video)
            return res.status(404).json({ message: 'Video not found' });
        console.log({ video })

        const result = await s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: video.bucketKey + '/' + filename,
        }));
        console.log({ result, key: video.bucketKey + '/' + filename })

        if (result.Body === undefined || result.Body === null)
            return res.status(404).send();

        res.setHeader("Content-Type", isPlaylist ? "application/vnd.apple.mpegurl" : "video/mp2t");

        if (result.ContentLength)
            res.setHeader("Content-Length", result.ContentLength);

        (result.Body as Readable).pipe(res)
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Error getting video file' });
    } finally {
        console.log('------------end------------')
    }
});

// For web applications
router.get('/file/:token/:videoId/:filename', async (req, res) => {
    try {
        console.log('/api/video/file/:token/:videoId/:filename')

        console.log('Validation...')
        let videoId: string | undefined = undefined, filename: string | undefined = undefined, token: string | undefined = undefined, isPlaylist
        try {
            token = await string().required().label('Token').validate(req.params.token?.toString())
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId?.toString())
            filename = await string().required().label('File name').validate(req.params.filename?.toString())

            isPlaylist = filename === "index.m3u8";
            const isSegment = /^segment_\d+\.ts$/.test(filename);
            if (!isPlaylist && !isSegment) {
                return res.status(400).json({ errors: ['Invalid file names requested'] });
            }
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ errors: ['Invalid parameters'] });
        }
        console.log({ videoId })

        console.log('Verifying token...')
        const { valid, userId } = verifyStreamToken(token, videoId);
        if (valid !== true)
            return res.status(401).send();

        const videoRepository = new VideoRepository()

        console.log("Checking weather video exists...");
        const video = await videoRepository.getForUser(videoId, userId!)
        if (!video)
            return res.status(404).json({ message: 'Video not found' });
        console.log({ video })

        const result = await s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: video.bucketKey + '/' + filename,
        }));
        console.log({ result, key: video.bucketKey + '/' + filename })

        if (result.Body === undefined || result.Body === null)
            return res.status(404).send();

        res.setHeader("Content-Type", isPlaylist ? "application/vnd.apple.mpegurl" : "video/mp2t");

        if (result.ContentLength)
            res.setHeader("Content-Length", result.ContentLength);

        (result.Body as Readable).pipe(res)
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Error getting video file' });
    } finally {
        console.log('------------end------------')
    }
});

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

        const userId = (req as any).user.userId

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