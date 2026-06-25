import express from 'express';
import { string, ValidationError } from 'yup';
import { auth, authorization } from '../middlewares/auth';
import { BUCKET_NAME, s3 } from '..';
import { Upload } from "@aws-sdk/lib-storage";
import AudioRepository from '../DB/repositories/AudioRepository';
import * as mm from "music-metadata";
import { fileTypeFromBuffer } from "file-type";
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { extension } from "mime-types";
import { teeStream } from '../lib/stream';

const router = express.Router();

router.post('/', auth, authorization, async (req, res) => {
    try {
        console.log('/api/audio', 'POST')

        console.log('Validating...')
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

        const userId = (req as any).user.userId

        const audioRepository = new AudioRepository()

        console.log("Checking weather title already exists...");
        const audio = await audioRepository.getForUserByTitle(title, userId);
        if (audio)
            return res.status(400).json({ message: 'Audio title must be unique.' });

        const audioFileBucketKey = `audio/${userId}/${title}`
        const coverArtBucketKey = `audio/cover_art/${userId}/${title}`

        console.log("Inserting audio...");
        const audioInsertResult = await audioRepository.insert({ title, fileName, contentType: "application/octet-stream", userId, bucketKey: audioFileBucketKey, temporary: true })
        console.log("Audio insert result", audioInsertResult);
        if (!audioInsertResult.acknowledged || !audioInsertResult.insertedId)
            return res.status(500).json({ ok: false, message: 'Audio info creation failed' })

        console.log("Splitting req stream...");
        let uploadAudio: Upload | null = null
        let uploadCoverArt: Upload | null = null;

        const { splitter, createBranch } = teeStream();

        const s3Stream = createBranch();
        const metaStream = createBranch();
        const typeStream = createBranch();

        const swallow = <T>(p: Promise<T>) => { p.catch(() => { }); return p; };

        let metadata, contentType: string = '', cover, coverExists
        try {
            req.on('error', (err) => {
                console.error('Request stream error:', err);
                splitter.destroy(err);
            });
            req.pipe(splitter);
            splitter.resume();

            console.log("Uploading audio file...");
            uploadAudio = new Upload({
                client: s3,
                params: {
                    Bucket: BUCKET_NAME,
                    Key: audioFileBucketKey,
                    Body: s3Stream
                }
            });
            const uploadPromise = swallow(uploadAudio.done());

            console.log("Extracting audio file info...");
            const metadataPromise = swallow(mm.parseStream(metaStream, {
                mimeType: req.headers["content-type"] as string
            }));

            console.log("Extracting audio file content type...");
            const contentTypePromise = swallow((async () => {
                const chunks: Buffer[] = [];
                let total = 0;
                const maxBytes = 8192;

                for await (const chunk of typeStream) {
                    const buffer = Buffer.isBuffer(chunk)
                        ? chunk
                        : Buffer.from(chunk);

                    chunks.push(buffer);
                    total += buffer.length;

                    if (total >= maxBytes) {
                        break;
                    }
                }

                const head = Buffer.concat(chunks, total);

                const result = await fileTypeFromBuffer(head);

                return result?.mime ?? "application/octet-stream";
            })());

            console.log("Waiting for streams to finish...");
            [, metadata, contentType] = await Promise.all([
                uploadPromise,
                metadataPromise,
                contentTypePromise,
            ]);

            console.log("Metadata:", metadata.common);

            const common = metadata.common;
            console.log({ metadata });

            cover = common.picture?.[0]
                ? {
                    data: common.picture[0].data,
                    mime: common.picture[0].format
                }
                : null;
            coverExists = cover && cover.data && cover.mime
            console.log({ coverExists, cover_mime: cover?.mime });

            if (coverExists) {
                uploadCoverArt = new Upload({
                    client: s3,
                    params: {
                        Bucket: BUCKET_NAME,
                        Key: coverArtBucketKey,
                        Body: cover?.data
                    }
                });
                await uploadCoverArt.done();
            }
        } catch (err) {
            console.error(err);

            splitter.destroy();

            try {
                await uploadAudio?.abort();
            } catch (abortErr) { console.error('Failed to abort segment/playlist uploads:', abortErr); }

            try {
                await uploadCoverArt?.abort();
            } catch (abortErr) { console.error('Failed to abort cover art upload:', abortErr); }

            return res.status(500).json({ message: 'Error uploading video file' });
        }

        const r = await audioRepository.unsafeUpdate(audioInsertResult.insertedId.toString(), userId, { contentType, temporary: false, coverArtKey: coverExists ? coverArtBucketKey : undefined, coverArtFileName: coverExists ? `${title}.${extension(cover!.mime)}` : undefined })
        if (!r.acknowledged || r.matchedCount !== 1) {
            await uploadAudio.abort();
            return res.status(500).json({ ok: false, message: 'Audio info update failed' });
        }

        res.status(201).json({ id: audioInsertResult });
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

        const userId = (req as any).user.userId

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

router.get('/file/:audioId', auth, async (req, res) => {
    try {
        console.log('/api/audio/file')

        console.log('Validation...')
        let audioId: string | undefined = undefined, download: boolean = false
        try {
            audioId = await string().objectIdString().required().label('Audio id').validate(req.params.audioId?.toString())
            let temp = await string().optional().label('Download').validate(req.params.download?.toString())
            download = temp === 'true';
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        console.log({ audioId })

        const userId = (req as any).user.userId

        const audioRepository = new AudioRepository()

        console.log("Checking weather audio exists...");
        const audio = await audioRepository.getForUser(audioId, userId)
        if (!audio) {
            res.status(404).json({ message: 'Audio not found' });
            return
        }
        console.log({ audio })

        const range = req.headers.range;

        const result = await s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: audio.bucketKey,
            Range: download ? undefined : range,
            ResponseContentDisposition: download ? `attachment; filename="${audio.fileName}"` : undefined,
        }));

        const stream = result.Body as any;

        const contentLength = result.ContentLength;
        const contentRange = result.ContentRange;

        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Type", result.ContentType || "application/octet-stream");

        if (range && contentRange) {
            res.status(206);
            res.setHeader("Content-Range", contentRange);
            res.setHeader("Content-Length", contentLength ?? "");
        } else {
            res.status(200);
            res.setHeader("Content-Length", contentLength ?? "");
        }

        stream.pipe(res);
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio file' });
    } finally {
        console.log('------------end------------')
    }
});

router.get('/coverArt/:audioId', auth, async (req, res) => {
    try {
        console.log('/api/audio/coverArt')

        console.log('Validation...')
        let audioId: string | undefined = undefined, download: boolean = false
        try {
            audioId = await string().objectIdString().required().label('Audio id').validate(req.params.audioId?.toString())
            let temp = await string().optional().label('Download').validate(req.params.download?.toString())
            download = temp === 'true';
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        console.log({ audioId })

        const userId = (req as any).user.userId

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

router.delete('/:audioId', auth, authorization, async (req, res) => {
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

        const userId = (req as any).user.userId

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