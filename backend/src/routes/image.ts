import express from 'express';
import { Readable } from 'stream';
import { streamToBuffer } from '../utils';
import { likeObjectId } from '../DB/common_schemas';
import { string } from 'yup';
import { auth, authorization } from '../middlewares/auth';
import { ImageRepository } from '../DB/repositories/ImageRepository';

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

        const imageRepository = new ImageRepository()

        console.log("Inserting image file...");
        // Will be permanent after user created corresponding leaf
        const imageFileId = await imageRepository.upload({ temporary: true, userId: (req as any).user.userId, contentType: req.headers['content-type'] }, { fileName: fileName, bytes: fileBuffer })
        console.log("Upload image file result", imageFileId);
        if (imageFileId === false || !imageFileId)
            return res.status(500).send()

        res.status(201).json({ imageFileId });

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Error uploading image file' });
    }
})

router.get('/info/', auth, async (req, res) => {
    try {
        console.log('/info')

        console.log('Validation...')
        let imageId: string | undefined = undefined
        try {
            imageId = req.query.imageId?.toString()

            if (!likeObjectId.required().isValidSync(imageId)) {
                res.status(400).json({ message: 'Invalid image id' });
                return
            }
        } catch (err) {
            console.error(err)
            res.status(400).json({ message: 'Invalid parameters' });
            return
        }
        console.log({ imageId })

        const imageRepository = new ImageRepository()

        let result = await imageRepository.getFile(imageId)

        console.log({ result })

        res.status(200).json(result)

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio' });
    }
});

router.get('/file/:imageId', auth, async (req, res) => {
    try {
        console.log('/file')

        const imageId = req.params.imageId
        if (!likeObjectId.isValidSync(imageId)) {
            res.status(400).json({ message: 'Invalid image id' });
            return
        }
        console.log('imageId', imageId)

        const imageRepository = new ImageRepository()
        const file = await imageRepository.getFile(imageId)
        if (!file) {
            res.status(404).json({ message: 'image file not found' });
            return
        }
        console.log('file', file)

        console.log('downloading...')
        imageRepository.downloadFile(res, file._id.toString())

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio file' });
    }
});

router.delete('/:imageId', auth, authorization, async (req, res) => {
    try {
        console.log('Validation...');
        const imageId = req.params.imageId
        if (!likeObjectId.isValidSync(imageId))
            return res.status(400).json({ message: 'Error uploading image file' });
        console.log({ imageId });

        const imageRepository = new ImageRepository()

        const image = await imageRepository.getFile(imageId)
        if (!image)
            return res.status(404).send()

        const imageDeleteResult = await imageRepository.deleteFile(imageId)
        if (imageDeleteResult !== true)
            res.status(500).json({ message: 'Couldn\'t delete image' });


        res.status(200).send()

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error deleting audio' });
    }
});

export { router as imageRoutes };