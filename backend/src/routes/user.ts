import express from 'express';
import { string } from 'yup';
import { generalRateLimiter } from '../middlewares/rateLimiting';
import { UserRepository } from '../DB/repositories/UserRepository';
import { AvatarRepository } from '../DB/repositories/AvatarRepository';
import { auth } from '../middlewares/auth';

const router = express.Router();

router.use(auth, generalRateLimiter)

router.get('/info', async (req, res) => {
    try {
        console.log('/api/user')

        console.log('Fetching...')
        const userRepository = new UserRepository()
        const result = await userRepository.get((req as any).user.userId)
        if (result === false) {
            res.status(401).send()
            return
        }

        res.status(200).json(result)

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

router.post('/avatar', async (req, res) => {
    try {
        console.log('/api/user/avatar')

        console.log('Validations...')
        let fileName: string | undefined
        try {
            fileName = req.query.name?.toString()
            console.log('fileName', fileName)
            if (!string().required().isValidSync(fileName)) {
                res.status(400).json({ message: 'Invalid file name' });
                return
            }
        } catch (err) {
            console.error(err)
            res.status(400).json({ message: 'Invalid file' });
            return
        }

        const avatarRepository = new AvatarRepository()
        const result = await avatarRepository.uploadAvatar((req as any).user.userId, { fileName, bytes: req, })
        if (result === false) {
            res.status(500).send();
            return
        }

        res.status(200).json(result)

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

router.get('/avatar', async (req, res) => {
    try {
        console.log('/api/user/avatar')

        const avatarRepository = new AvatarRepository()

        const file = await avatarRepository.getFileByUserId((req as any).user.userId)
        if (file === false) {
            res.status(500).send();
            return
        }

        const result = await avatarRepository.downloadFile(res, file._id.toString())
        if (result === false) {
            res.status(500).send();
            return
        }

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

export { router as userRoutes };
