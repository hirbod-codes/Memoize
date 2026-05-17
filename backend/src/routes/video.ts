import express from 'express';
import { Readable } from 'stream';
import { streamToBuffer } from '../utils';
import { likeObjectId } from '../DB/common_schemas';
import { string } from 'yup';
import { auth, authorization } from '../middlewares/auth';
import { VideoRepository } from '../DB/repositories/VideoRepository';

const router = express.Router();

router.post('/upload', auth, authorization, async (req, res) => {
    try {
        console.log('/upload')

        console.log('Validating...')
        let fileName: string | undefined,
            fileBuffer: Buffer
        try {
            fileName = req.query.name?.toString()
            console.log({ fileName })

            if (!string().required().isValidSync(fileName))
                return res.status(400).json({ message: 'Invalid file name' });

            console.log({ fileName })

            const fileStream = Readable.from(req);
            fileBuffer = await streamToBuffer(fileStream)
        } catch (err) {
            console.error(err)
            res.status(400).json({ message: 'Invalid file' });
            return
        }

        const videoRepository = new VideoRepository()

        console.log("Inserting video file...");
        const videoFileId = await videoRepository.upload({ temporary: false, userId: (req as any).user.userId, contentType: req.headers['content-type'] }, { fileName: fileName, bytes: fileBuffer })
        console.log("Upload video file result", videoFileId);
        if (videoFileId === false || !videoFileId)
            return res.status(500).send()

        res.status(201).send();

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
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

        const videoRepository = new VideoRepository()

        let result = await videoRepository.getFile(videoId)

        console.log({ result })

        res.status(200).json(result)

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio' });
    }
});

router.get('/file/:videoId', auth, async (req, res) => {
    try {
        console.log('/file')

        const videoId = req.params.videoId
        if (!likeObjectId.isValidSync(videoId)) {
            res.status(400).json({ message: 'Invalid video id' });
            return
        }
        console.log('videoId', videoId)

        const videoRepository = new VideoRepository()
        const file = await videoRepository.getFile(videoId)
        if (!file) {
            res.status(404).json({ message: 'video file not found' });
            return
        }
        console.log('file', file)

        console.log('downloading...')
        videoRepository.downloadFile(res, file._id.toString())

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

        const videoRepository = new VideoRepository()

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