import express from 'express';
import { PassThrough } from 'stream';
import { string, ValidationError } from 'yup';
import { auth, authorization } from '../middlewares/auth';
import { s3 } from '..';
import { Upload } from "@aws-sdk/lib-storage";
import AudioRepository from '../DB/repositories/AudioRepository';
import * as mm from "music-metadata";
import { fileTypeFromBuffer } from "file-type";
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { extension } from "mime-types";

const router = express.Router();

router.post('/', auth, authorization, async (req, res) => {
    let uploadAudio: Upload | null = null, uploadCoverArt: Upload | null = null;
    const s3Stream = new PassThrough();
    const metaStream = new PassThrough();
    const typeStream = new PassThrough();

    try {
        console.log('/api/audio/upload', 'POST')

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
        req.pipe(s3Stream);
        req.pipe(metaStream);
        req.pipe(typeStream);

        console.log("Uploading audio file...");
        uploadAudio = new Upload({
            client: s3,
            params: {
                Bucket: "memoize",
                Key: audioFileBucketKey,
                Body: s3Stream
            }
        });
        const uploadPromise = uploadAudio.done();

        console.log("Extracting audio file info...");
        const metadataPromise = mm.parseStream(metaStream, {
            mimeType: req.headers["content-type"] as string
        });

        console.log("Extracting audio file content type...");
        const contentTypePromise = (async () => {
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
        })();

        console.log("Waiting for streams to finish...");
        const [uploadResult, metadata, contentType] = await Promise.all([
            uploadPromise,
            metadataPromise,
            contentTypePromise,
        ]);

        console.log("Metadata:", metadata.common);

        const common = metadata.common;
        console.log({ metadata });

        const cover = common.picture?.[0]
            ? {
                data: common.picture[0].data,
                mime: common.picture[0].format
            }
            : null;
        const coverExists = cover && cover.data && cover.mime
        console.log({ coverExists, cover_mime: cover?.mime });

        if (coverExists) {
            uploadCoverArt = new Upload({
                client: s3,
                params: {
                    Bucket: "memoize",
                    Key: coverArtBucketKey,
                    Body: cover?.data
                }
            });
            await uploadCoverArt.done();
        }

        const r = await audioRepository.unsafeUpdate(audioInsertResult.insertedId.toString(), userId, { contentType, temporary: false, coverArtKey: coverExists ? coverArtBucketKey : undefined, coverArtFileName: coverExists ? `${title}.${extension(cover.mime)}` : undefined })
        if (!r.acknowledged || r.matchedCount !== 1) {
            await uploadAudio.abort();
            return res.status(500).json({ ok: false, message: 'Audio info update failed' });
        }

        res.status(201).json({ id: audioInsertResult });

        console.log('------------end------------')
    } catch (err) {
        try {
            if (uploadAudio)
                await uploadAudio.abort();

            if (uploadCoverArt)
                await uploadCoverArt.abort();
        } catch (_) { console.error('Failure while trying to abort uploads.'); }

        try {
            s3Stream.destroy(err as Error);
            metaStream.destroy(err as Error);
            typeStream.destroy(err as Error);
        } catch (_) { console.error('Failure while trying to destroy streams.'); }

        console.error(err)
        res.status(500).json({ message: 'Error uploading audio file' });
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

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio' });
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
            Bucket: "memoize",
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

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio file' });
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
            Bucket: "memoize",
            Key: audio.coverArtKey,
            ResponseContentDisposition: download ? `attachment; filename="${audio.coverArtFileName}"` : undefined,
        }));

        (result.Body as any).pipe(res)
        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio file' });
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
                Bucket: "memoize",
                Key: audio.bucketKey
            })
        );

        if (audio?.coverArtKey) {
            console.log("Deleting audio file cover art in the bucket storage...");
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: "memoize",
                    Key: audio.coverArtKey
                })
            );
        }

        console.log("Deleting audio in DB...");
        const rr = await audioRepository.delete(audioId)
        if (!rr.acknowledged)
            return res.status(500).send()

        res.status(200).send();

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error deleting audio' });
    }
});

export { router as audioRoutes };