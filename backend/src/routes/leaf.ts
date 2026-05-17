import express from 'express';
import { likeObjectId } from '../DB/common_schemas';
import { auth } from '../middlewares/auth';
import { Leaf, leafValidationSchema } from '../DB/models/Leaf';
import LeafRepository from '../DB/repositories/LeafRepository';
import { array } from 'yup';

const router = express.Router();

router.use(auth)

router.post('/', async (req, res) => {
    try {
        console.log('/api/leaf', 'POST')

        console.log('Validation...')
        let leaf: Leaf
        try {
            leaf = req.body.leaf

            if (!leafValidationSchema.required().isValidSync(leaf))
                return res.status(400).json({ message: 'Invalid leaf' });
        } catch (err) {
            res.status(400).json({ message: 'Invalid artist id' });
            return
        }
        console.log({ leaf });

        const leafRepository = new LeafRepository()

        console.log("Inserting new leaf...");
        const insertLeafResult = await leafRepository.insert(leaf)
        console.log("Insert result", insertLeafResult);

        res.status(201).send()
        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
})

router.get('/', async (req, res) => {
    try {
        console.log('/api/leaf')

        console.log('Validation...')
        let leafIds: string[] | undefined
        try {
            let temp = req.query.leafIds?.toString()
            if (!likeObjectId.required().isValidSync(temp)) {
                res.status(400).json({ message: 'Invalid artist leafIds' });
                return
            }

            leafIds = temp.split(',')

            if (!array().min(1).of(likeObjectId.required()).required().isValidSync(leafIds)) {
                res.status(400).json({ message: 'Invalid Tree node ids' });
                return
            }
        } catch (err) {
            res.status(400).json({ message: 'Invalid artist leafIds' });
            return
        }
        console.log({ leafIds, name });

        console.log("Downloading avatar...");
        const leafRepository = new LeafRepository()
        const leaf = await leafRepository.getManyForUser(leafIds, (req as any).user.userId)
        if (!leaf) {
            res.status(404).send()
            return
        }

        res.status(200).json(leaf)
        console.log('------------end------------')
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
})

router.delete('/', async (req, res) => {
    try {
        console.log('/api/leaf')

        console.log('Validation...')
        let id: string | undefined
        try {
            id = req.query.id?.toString()
            if (!likeObjectId.required().isValidSync(id)) {
                res.status(400).json({ message: 'Invalid artist id' });
                return
            }
        } catch (err) {
            res.status(400).json({ message: 'Invalid artist id' });
            return
        }
        console.log({ id, name });

        console.log("Downloading avatar...");
        const leafRepository = new LeafRepository()
        const leaf = await leafRepository.delete(id)
        if (!leaf) {
            res.status(404).send()
            return
        }

        res.status(200).json(leaf)
        console.log('------------end------------')
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
})

export { router as leafRoutes };
