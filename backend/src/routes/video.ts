import fs from 'fs'
import express from 'express';
import { likeObjectId } from '../DB/common_schemas';
import { array, number, string } from 'yup';
import { auth, authorization } from '../middlewares/auth';
import { VideoFileRepository } from '../DB/repositories/VideoFileRepository';
import { ThumbnailRepository } from '../DB/repositories/ThumbnailRepository';
import path from 'path';
import { decodeVideoToDisk } from '../ffmpeg';
import VideoRepository from '../DB/repositories/VideoRepository';

const router = express.Router();

router.post('/upload', auth, authorization, async (req, res) => {
    let tempDir
    try {
        console.log('/upload')

        console.log('Validating...')
        let fileName: string | undefined,
            fileBuffer: Buffer,
            title: string | undefined
        try {
            title = req.query.title?.toString()
            fileName = req.query.fileName?.toString()
            console.log({ fileName, title })

            if (!string().required().isValidSync(fileName))
                return res.status(400).json({ message: 'Invalid file name' });

            if (!string().required().isValidSync(title))
                return res.status(400).json({ message: 'Invalid title' });

            console.log({ fileName, title })
        } catch (err) {
            console.error(err)
            res.status(400).json({ message: 'Invalid file' });
            return
        }

        const videoRepository = new VideoRepository()
        const videoFileRepository = new VideoFileRepository()

        console.log('Inserting video info...');
        const videoInsertResult = await videoRepository.insert({ title: fileName, userId: (req as any).user.userId, temporary: true })
        if (!videoInsertResult.acknowledged)
            return res.status(500).send()
        const videoId = videoInsertResult.insertedId.toString()

        tempDir = path.join('temp', 'videos', videoId)

        await decodeVideoToDisk(req, tempDir)

        const files = fs.readdirSync(tempDir)

        const uploaded = []

        console.log("Uploading video file segments...");
        for (const file of files) {
            const filePath = path.join(tempDir, file)
            const readStream = fs.createReadStream(filePath)

            const contentType = file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t'

            // Will be permanent after user created corresponding leaf
            const videoFileId = await videoFileRepository.upload({ videoId, temporary: true, userId: (req as any).user.userId, contentType }, { fileName: file, bytes: readStream })
            console.log("Upload video file result", videoFileId);
            if (videoFileId === false || !videoFileId)
                return res.status(500).send()

            uploaded.push({ file, id: videoFileId })
        }
        console.log(JSON.stringify(uploaded, undefined, 4))

        fs.rmSync(tempDir, { force: true, recursive: true })

        res.status(201).json({ videoId });

        console.log('------------end------------')
    } catch (err) {
        console.error(err)

        if (tempDir)
            fs.rmSync(tempDir, { force: true, recursive: true })

        res.status(500).json({ message: 'Error uploading video file' });
    }
})

router.get('/info/', auth, async (req, res) => {
    try {
        console.log('/info')

        console.log('Validation...')
        let videoId: string | undefined = undefined
        try {
            videoId = req.query.videoId?.toString()

            if (!likeObjectId.required().isValidSync(videoId)) {
                res.status(400).json({ message: 'Invalid video id' });
                return
            }
        } catch (err) {
            console.error(err)
            res.status(400).json({ message: 'Invalid parameters' });
            return
        }
        console.log({ videoId })

        const videoRepository = new VideoFileRepository()

        let result = await videoRepository.getFile(videoId)

        console.log({ result })

        res.status(200).json(result)

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio' });
    }
});

router.get('/file/:videoId/:fileName', auth, async (req, res) => {
    try {
        console.log('/api/video/file/:videoId')

        console.log('Validation...')
        let videoId: string | undefined, fileName: string | undefined
        try {
            videoId = req.params.videoId.toString()
            fileName = req.params.fileName.toString()
            console.log({ videoId, fileName })

            if (!likeObjectId.isValidSync(videoId))
                return res.status(400).json({ message: 'Invalid video id' });

            if (!likeObjectId.isValidSync(fileName))
                return res.status(400).json({ message: 'Invalid video id' });
        } catch (err) {
            console.error(err);
            return res.status(400).send()
        }

        const videoFileRepository = new VideoFileRepository()

        const file = await videoFileRepository.getFileByVideoId(videoId, fileName)
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

        const videoId = req.params.videoId
        if (!likeObjectId.isValidSync(videoId)) {
            res.status(400).json({ message: 'Invalid video id' });
            return
        }
        console.log('videoId', videoId)

        const thumbnailRepository = new ThumbnailRepository()
        const file = await thumbnailRepository.getFile(videoId)
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
        console.log('Validation...');
        const videoId = req.params.videoId
        if (!likeObjectId.isValidSync(videoId))
            return res.status(400).json({ message: 'Error uploading video file' });
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