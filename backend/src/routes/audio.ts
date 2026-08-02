import express from 'express';
import { string, ValidationError } from 'yup';
import { auth, authenticateToken, authorization } from '../middlewares/auth';
import { BUCKET_NAME, s3, ttsApiKey } from '..';
import { Upload } from "@aws-sdk/lib-storage";
import AudioRepository from '../DB/repositories/AudioRepository';
import * as mm from "music-metadata";
import { fileTypeFromBuffer } from "file-type";
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { extension } from "mime-types";
import { teeStream } from '../lib/stream';
import { MaxFileSizeExceededError } from '../errors/MaxFileSizeExceededError';
import { MinFileSizeNotMetError } from '../errors/MinFileSizeNotMetError';
import { generateStreamToken, verifyStreamToken } from '../lib/signed_urls';
import { UserRepository } from '../DB/repositories/UserRepository';
import { httpsStreamRequest } from '../utils';

const router = express.Router();

router.post('/', auth, authorization, async (req, res) => {
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

        const userId = (req as any).user.userId

        const audioRepository = new AudioRepository()

        console.log("Checking weather title already exists...");
        // ------------------------------------------------------------------------- Checking weather title already exists...
        const audio = await audioRepository.getForUserByTitle(title, userId);
        if (audio)
            return res.status(400).json({ message: 'Audio title must be unique.' });

        const audioFileBucketKey = `audio/${userId}/${title}`
        const coverArtBucketKey = `audio/cover_art/${userId}/${title}`

        console.log("Inserting audio...");
        // ------------------------------------------------------------------------- Inserting audio...
        const audioInsertResult = await audioRepository.insert({ title, fileName, contentType: "application/octet-stream", userId, bucketKey: audioFileBucketKey, temporary: true })
        console.log("Audio insert result", audioInsertResult);
        if (!audioInsertResult.acknowledged || !audioInsertResult.insertedId)
            return res.status(500).json({ ok: false, message: 'Audio info creation failed' })

        console.log("Splitting req stream...");
        // ------------------------------------------------------------------------- Splitting req stream...
        const { splitter, createBranch } = teeStream();

        const s3Stream = createBranch();
        const metadataStream = createBranch();
        const typeStream = createBranch();

        const swallow = <T>(p: Promise<T>) => { p.catch((e) => { console.error('swallow throws an error.', e); }); return p; };

        let uploadAudio: Upload | null = null
        let uploadCoverArt: Upload | null = null;
        let metadata
        let contentType: string = ''
        let cover
        let coverExists

        let totalBytes = 0;
        let sizeLimitError: MaxFileSizeExceededError | null = null;
        const minFileSize = 10 * 1024
        const maxFileSize = 2 * 1024 * 1024 * 1024
        try {
            splitter.on('error', () => { });
            req.on('error', (err) => {
                console.error('Request stream error:', err);
                splitter.destroy(err);
            });
            req.on('data', (chunk: Buffer) => {
                totalBytes += chunk.length;
                if (sizeLimitError) return; // already tripped, ignore further chunks
                if (totalBytes > maxFileSize) {
                    sizeLimitError = new MaxFileSizeExceededError(maxFileSize, totalBytes);
                    console.error(`[size] Max limit exceeded (${totalBytes} bytes), aborting`);
                    req.destroy(sizeLimitError);
                    splitter.destroy(sizeLimitError);
                }
            });
            req.pipe(splitter);
            splitter.resume();

            console.log("Uploading audio file...");
            // ------------------------------------------------------------------------- Uploading audio file...
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
            // ------------------------------------------------------------------------- Extracting audio file info...
            const metadataPromise = swallow((async () => {
                try {
                    return await mm.parseStream(metadataStream, {
                        mimeType: req.headers["content-type"] as string
                    })
                } finally {
                    if (!metadataStream.destroyed) metadataStream.destroy()
                }
            })());

            console.log("Extracting audio file content type...");
            // ------------------------------------------------------------------------- Extracting audio file content type...
            const contentTypePromise = swallow((async () => {
                const chunks: Buffer[] = [];
                let total = 0;

                try {
                    for await (const chunk of typeStream) {
                        const buffer = Buffer.isBuffer(chunk)
                            ? chunk
                            : Buffer.from(chunk);

                        chunks.push(buffer);
                        total += buffer.length;

                        if (total >= maxFileSize) {
                            break;
                        }
                    }
                } finally {
                    if (!typeStream.destroyed) typeStream.destroy();
                }

                const head = Buffer.concat(chunks, total);

                const result = await fileTypeFromBuffer(head);

                return result?.mime ?? "application/octet-stream";
            })());

            console.log("Waiting for streams to finish...");
            // ------------------------------------------------------------------------- Waiting for streams to finish...
            [, metadata, contentType] = await Promise.all([
                uploadPromise,
                metadataPromise,
                contentTypePromise,
            ]);

            if (sizeLimitError)
                throw sizeLimitError;

            if (totalBytes < minFileSize)
                throw new MinFileSizeNotMetError(minFileSize, totalBytes);

            const common = metadata.common;
            console.log({ metadata, common });

            cover = common.picture?.[0]
                ? {
                    data: common.picture[0].data,
                    mime: common.picture[0].format
                }
                : null;
            coverExists = cover && cover.data && cover.mime
            console.log({ coverExists, cover_mime: cover?.mime });

            if (coverExists) {
                console.log("Uploading cover art...");
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

            if (err instanceof MaxFileSizeExceededError) {
                return res.status(413).json({ errors: [err.message] });
            }
            if (err instanceof MinFileSizeNotMetError) {
                return res.status(400).json({ errors: [err.message] });
            }

            return res.status(500).json({ message: 'Error uploading video file' });
        }

        console.log("Making final changes to video document in db...");
        // ------------------------------------------------------------------------- Making final changes to video document in db...
        const unsafeUpdateResult = await audioRepository.unsafeUpdate(audioInsertResult.insertedId.toString(), userId, { contentType, temporary: false, coverArtKey: coverExists ? coverArtBucketKey : undefined, coverArtFileName: coverExists ? `${title}.${extension(cover!.mime)}` : undefined })
        console.log({ r: unsafeUpdateResult });
        if (!unsafeUpdateResult.acknowledged || unsafeUpdateResult.matchedCount !== 1) {
            await uploadAudio.abort();
            return res.status(500).json({ ok: false, message: 'Audio info update failed' });
        }

        res.status(201).json({ id: audioInsertResult.insertedId.toString() });
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

        const userId = (req as any).user.userId

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

            if (user.ttsApiKey)
                userTtsApiKey = user.ttsApiKey;
            else if (ttsApiKey)
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
        if (valid !== true)
            return res.status(401).send();

        const audioRepository = new AudioRepository()

        console.log("Checking weather audio exists...");
        const audio = await audioRepository.getForUser(audioId, userId!)
        if (!audio)
            return res.status(404).json({ message: 'Audio not found' });
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
        console.error(err)
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
            let temp = await string().optional().label('Download').validate(req.query.download?.toString())
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