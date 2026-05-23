import express from 'express';
import { Readable } from 'stream';
import { streamToBuffer } from '../utils';
import { string, ValidationError } from 'yup';
import { auth, authorization } from '../middlewares/auth';
import { ImageRepository } from '../DB/repositories/ImageRepository';

const router = express.Router();

router.post('/', auth, authorization, async (req, res) => {
    try {
        console.log('/upload')

        console.log('Validating...')
        let fileName: string | undefined, fileBuffer: Buffer, title: string | undefined
        try {
            title = await string().required().label('Title').validate(req.query.title?.toString())
            fileName = await string().required().label('File name').validate(req.query.fileName?.toString())
            const fileStream = Readable.from(req);
            fileBuffer = await streamToBuffer(fileStream)
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ fileName })

        const imageRepository = new ImageRepository()

        console.log("Inserting image file...");
        // Will be permanent after user created corresponding leaf
        const imageFileId = await imageRepository.upload({ title, temporary: true, userId: (req as any).user.userId, contentType: req.headers['content-type'] }, { fileName: fileName, bytes: fileBuffer })
        console.log("Upload image file result", imageFileId);
        if (imageFileId === false || !imageFileId)
            return res.status(500).send()

        res.status(201).json({ id: imageFileId });

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
            imageId = await string().objectIdString().required().label('Image id').validate(req.query.imageId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
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

        console.log('Validation...')
        let imageId: string | undefined = undefined
        try {
            imageId = await string().objectIdString().required().label('Image id').validate(req.params.imageId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ imageId })

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
        console.log('Validation...')
        let imageId: string | undefined = undefined
        try {
            imageId = await string().objectIdString().required().label('Image id').validate(req.params.imageId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ imageId })

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