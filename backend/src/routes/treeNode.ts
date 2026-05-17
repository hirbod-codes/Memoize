import express from 'express';
import { likeObjectId } from '../DB/common_schemas';
import { auth } from '../middlewares/auth';
import { TreeNode, treeNodeValidationSchema } from '../DB/models/TreeNode';
import TreeNodeRepository from '../DB/repositories/TreeNodeRepository';
import { array, string } from 'yup';

const router = express.Router();

router.use(auth)

router.post('/', async (req, res) => {
    try {
        console.log('/api/treeNode', 'POST')

        console.log('Validation...')
        let treeNode: TreeNode
        try {
            treeNode = req.body.treeNode

            if (!treeNodeValidationSchema.required().isValidSync(treeNode))
                return res.status(400).json({ message: 'Invalid Tree node' });
        } catch (err) {
            res.status(400).json({ message: 'Invalid Tree node' });
            return
        }
        console.log({ treeNode });

        const treeNodeRepository = new TreeNodeRepository()

        console.log("Inserting new treeNode...");
        const insertTreeNodeResult = await treeNodeRepository.insert(treeNode)
        console.log("Insert result", insertTreeNodeResult);

        res.status(201).send()
        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
})

router.get('/', async (req, res) => {
    try {
        console.log('/api/treeNode')

        console.log('Validation...')
        let treeNodeIds: string[] | undefined
        try {
            let temp = req.query.treeNodeIds?.toString()
            if (!string().required().isValidSync(temp)) {
                res.status(400).json({ message: 'Invalid Tree node ids' });
                return
            }
            treeNodeIds = temp.split(',').map(m => m.trim())

            if (!array().min(1).of(likeObjectId.required()).required().isValidSync(treeNodeIds)) {
                res.status(400).json({ message: 'Invalid Tree node ids' });
                return
            }
        } catch (err) {
            res.status(400).json({ message: 'Invalid Tree node ids' });
            return
        }
        console.log({ treeNodeIds });

        console.log("fetching...");
        const treeNodeRepository = new TreeNodeRepository()
        const treeNode = await treeNodeRepository.getManyForUser(treeNodeIds, (req as any).user.userId)
        if (!treeNode) {
            res.status(404).send()
            return
        }

        res.status(200).json(treeNode)
        console.log('------------end------------')
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
})

router.get('/root', async (req, res) => {
    try {
        console.log('/api/treeNode/root')

        console.log("fetching...");
        const treeNodeRepository = new TreeNodeRepository()
        const treeNode = await treeNodeRepository.getRootsForUser((req as any).user.userId)
        if (!treeNode) {
            res.status(404).send()
            return
        }

        res.status(200).json(treeNode)
        console.log('------------end------------')
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
})

router.delete('/', async (req, res) => {
    try {
        console.log('/api/treeNode')

        console.log('Validation...')
        let id: string | undefined
        try {
            id = req.query.id?.toString()
            if (!likeObjectId.required().isValidSync(id)) {
                res.status(400).json({ message: 'Invalid id' });
                return
            }
        } catch (err) {
            res.status(400).json({ message: 'Invalid id' });
            return
        }
        console.log({ id, name });

        console.log("Downloading avatar...");
        const treeNodeRepository = new TreeNodeRepository()
        const treeNode = await treeNodeRepository.deleteForUser(id, (req as any).user.userId)
        if (!treeNode) {
            res.status(404).send()
            return
        }

        res.status(200).json(treeNode)
        console.log('------------end------------')
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
})

export { router as treeNodeRoutes };
