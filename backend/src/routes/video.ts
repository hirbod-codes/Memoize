import fs from 'fs'
import express from 'express';
import { string, ValidationError } from 'yup';
import { auth, authorization } from '../middlewares/auth';
import { VideoFileRepository } from '../DB/repositories/VideoFileRepository';
import { ThumbnailRepository } from '../DB/repositories/ThumbnailRepository';
import path from 'path';
import { decodeVideoFileToDisk, decodeVideoStreamToDisk, generateThumbnailFromVideoFileToDisk } from '../ffmpeg';
import VideoRepository from '../DB/repositories/VideoRepository';
import { MongoDB } from '../DB/mongodb';
import { streamToBuffer } from '../utils';
import { Readable } from 'stream';

const router = express.Router();

router.post('/thumbnail', auth, authorization, async (req, res) => {
    let tempDir
    try {
        console.log('/upload/thumbnail')

        console.log('Validating...')
        let videoId: string | undefined, fileName: string | undefined
        try {
            videoId = await string().objectIdString().required().label('Video').validate(req.query.videoId?.toString())
            fileName = await string().required().label('File name').validate(req.query.fileName?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ videoId, fileName })

        const userId = (req as any).user.userId

        const thumbnailRepository = new ThumbnailRepository()
        const id = await thumbnailRepository.upload({ temporary: false, userId, videoId, contentType: req.headers['content-type'] }, { fileName, bytes: req, contentType: req.headers['content-type'] })
        if (id === false || !id)
            return res.status(500).send()

        res.status(201).json({ videoId });

        console.log('------------end------------')
    } catch (err) {
        console.error(err)

        if (tempDir)
            fs.rmSync(tempDir, { force: true, recursive: true })

        res.status(500).json({ message: 'Error uploading video file' });
    }
})

router.post('/', auth, authorization, async (req, res) => {
    let db: MongoDB | undefined = undefined, tempDir
    try {
        console.log('/upload')

        console.log('Validating...')
        let fileName: string | undefined, title: string | undefined
        try {
            title = await string().required().label('Title').validate(req.query.title?.toString())
            fileName = await string().required().label('File name').validate(req.query.fileName?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ fileName, title })

        db = MongoDB.getDbInstance()
        const session = await db.startTransaction()

        const videoRepository = new VideoRepository()
        videoRepository.setTransactionSession(session)

        const videoFileRepository = new VideoFileRepository()
        videoFileRepository.setTransactionSession(session)

        const thumbnailRepository = new ThumbnailRepository()
        thumbnailRepository.setTransactionSession(session)

        console.log('Inserting video info...');
        const videoInsertResult = await videoRepository.insert({ title, userId: (req as any).user.userId, temporary: true })
        if (!videoInsertResult.acknowledged)
            return res.status(500).send()
        const videoId = videoInsertResult.insertedId.toString()

        tempDir = path.join('temp', 'videos', videoId)
        fs.mkdirSync(tempDir, { recursive: true })

        console.log('Checking file size...')
        const MAX_BYTES = 10 * 1024 * 1024 * 1024;
        const contentLength = Number(req.headers["content-length"]);
        if (contentLength > MAX_BYTES)
            return res.status(413).send("File too large");

        let total = 0;
        req.on("data", (chunk) => {
            total += chunk.length;

            if (total > MAX_BYTES) {
                req.destroy(new Error("File too large"));
                return;
            }
        });

        const file = path.join(tempDir, fileName)
        const writeStream = fs.createWriteStream(file)

        req.on("data", (chunk) => {
            total += chunk.length;

            if (total > MAX_BYTES) {
                res.statusCode = 413;
                res.end("File too large");

                req.destroy();
                writeStream.destroy();

                fs.unlink(file, (e) => { if (e) console.error(e) });
            }
        });
        req.pipe(writeStream)

        await decodeVideoFileToDisk(file, tempDir)
        await generateThumbnailFromVideoFileToDisk(file, tempDir)

        const files = fs.readdirSync(tempDir)

        let uploadedThumbnailId: string | undefined = undefined
        const uploaded = []

        console.log("Uploading video file segments...");
        for (const file of files) {
            const filePath = path.join(tempDir, file)
            const readStream = fs.createReadStream(filePath)

            if (file.includes('thumbnail')) {
                const contentType = 'image/jpeg'

                const thumbnailId = await thumbnailRepository.upload({ userId: (req as any).user.userId, temporary: false, videoId, contentType }, { fileName: file, bytes: readStream })
                console.log("Upload thumbnail result", thumbnailId);
                if (thumbnailId === false || !thumbnailId)
                    return res.status(500).send()

                uploadedThumbnailId = thumbnailId
            } else {
                const contentType = file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t'

                // Will be permanent after user created corresponding leaf
                const videoFileId = await videoFileRepository.upload({ videoId, temporary: true, userId: (req as any).user.userId, contentType }, { fileName: file, bytes: readStream })
                console.log("Upload video file result", videoFileId);
                if (videoFileId === false || !videoFileId)
                    return res.status(500).send()

                uploaded.push({ file, id: videoFileId })
            }
        }
        console.log(JSON.stringify(uploaded, undefined, 4))

        fs.rmSync(tempDir, { force: true, recursive: true })

        let makePermanentResult = await videoFileRepository.makePermanentByVideoId(videoId)
        if (makePermanentResult === false || !makePermanentResult.acknowledged)
            return res.status(500).send()

        makePermanentResult = await thumbnailRepository.makePermanentByVideoId(videoId)
        if (makePermanentResult === false || !makePermanentResult.acknowledged)
            return res.status(500).send()

        await db.commitTransaction()

        res.status(201).json({ id: videoId, thumbnailId: uploadedThumbnailId });

        console.log('------------end------------')
    } catch (err) {
        console.error(err)

        if (tempDir && fs.existsSync(tempDir))
            fs.rmSync(tempDir, { force: true, recursive: true })

        if (db)
            await db.abortTransaction()

        res.status(500).json({ message: 'Error uploading video file' });
    } finally {
        if (tempDir && fs.existsSync(tempDir))
            fs.rmSync(tempDir, { force: true, recursive: true })

    }
})

router.get('/info', auth, async (req, res) => {
    try {
        console.log('/info')

        console.log('Validation...')
        let videoId: string | undefined = undefined
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.query.videoId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ videoId })

        const videoRepository = new VideoRepository()

        let result = (await videoRepository.getForUser(videoId, (req as any).user.userId))

        console.log({ result })

        res.status(200).json(result)

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio' });
    }
});

router.patch('/', auth, async (req, res) => {
    try {
        console.log('/', 'PATCH')

        console.log('Validation...')
        let videoId: string | undefined = undefined, title: string | undefined
        try {
            title = await string().required().label('Title').validate(req.query.title?.toString())
            videoId = await string().objectIdString().required().label('Video id').validate(req.query.videoId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ videoId, title })

        const videoRepository = new VideoRepository()

        let result = await videoRepository.updateTitle(videoId, title)
        if (!result.acknowledged)
            return res.status(500).send()
        console.log({ result })

        res.status(200).send()

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio' });
    }
});

router.get('/file/:videoId/:fileName', auth, async (req, res) => {
    try {
        console.log('/api/video/file/:videoId/:fileName')

        console.log('Validation...')
        let videoId: string | undefined, fileName: string | undefined
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId.toString())
            fileName = await string().required().label('File name').validate(req.params.fileName.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ videoId, fileName })

        const videoFileRepository = new VideoFileRepository()

        const file = await videoFileRepository.getFileForUserByVideoId(videoId, fileName, (req as any).user.userId)
        if (!file) {
            res.status(404).json({ message: 'video file not found' });
            return
        }
        console.log('file', file)

        res.setHeader("Content-Type", file.metadata?.contentType)
        res.setHeader("Cache-Control", 'no-cache')

        console.log('streaming...')
        videoFileRepository.downloadFile(res, file._id.toString())

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio file' });
    }
});

router.get('/thumbnail/:videoId', auth, async (req, res) => {
    try {
        console.log('/api/video/thumbnail/:videoId')

        let videoId: string
        try {
            videoId = await string().objectIdString().required().label('Video id').validate(req.params.videoId)
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log('videoId', videoId)

        const thumbnailRepository = new ThumbnailRepository()
        const file = await thumbnailRepository.getFileByVideoId(videoId)
        if (!file) {
            res.status(404).json({ message: 'video file not found' });
            return
        }
        console.log('file', file)

        console.log('downloading...')
        thumbnailRepository.downloadFile(res, file._id.toString())

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio file' });
    }
});

router.delete('/:videoId', auth, authorization, async (req, res) => {
    try {
        console.log('Validation...')
        let videoId: string
        try {
            videoId = await string().required().objectIdString().label('Video id').validate(req.params.videoId)
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ videoId });

        const videoRepository = new VideoFileRepository()

        const video = await videoRepository.getFile(videoId)
        if (!video)
            return res.status(404).send()

        const videoDeleteResult = await videoRepository.deleteFile(videoId)
        if (videoDeleteResult !== true)
            res.status(500).json({ message: 'Couldn\'t delete video' });


        res.status(200).send()

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error deleting audio' });
    }
});

export { router as videoRoutes };