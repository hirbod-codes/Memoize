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
        let treeNode: TreeNode, parentTreeNodeId: string | undefined
        try {
            treeNode = req.body.treeNode
            parentTreeNodeId = req.body.parentTreeNodeId

            treeNode.userId = (req as any).user.userId
            if (!treeNodeValidationSchema.required().isValidSync(treeNode))
                return res.status(400).json({ message: 'Invalid Tree node' });

            if (!string().required().isValidSync(parentTreeNodeId))
                return res.status(400).json({ message: 'Invalid Parent tree node id' });
        } catch (err) {
            res.status(400).json({ message: 'Invalid Tree node' });
            return
        }
        console.log({ treeNode });

        const treeNodeRepository = new TreeNodeRepository()

        console.log("Inserting new treeNode...");
        const insertTreeNodeResult = await treeNodeRepository.insert(treeNode)
        console.log("Insert result", insertTreeNodeResult);
        if (!insertTreeNodeResult.acknowledged)
            return res.status(500).send()

        console.log("Adding new treeNode to parent treeNode...");
        const addTreeNodeResult = await treeNodeRepository.addTreeNode(parentTreeNodeId, insertTreeNodeResult.insertedId.toString())
        console.log("add result", addTreeNodeResult);
        if (!addTreeNodeResult.acknowledged || addTreeNodeResult.matchedCount === 0)
            return res.status(500).send()

        res.status(201).json({ id: insertTreeNodeResult.insertedId.toString() })
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
        let treeNodeId: string | undefined
        try {
            treeNodeId = req.query.treeNodeId?.toString()
            if (!likeObjectId.required().isValidSync(treeNodeId)) {
                res.status(400).json({ message: 'Invalid id' });
                return
            }
        } catch (err) {
            res.status(400).json({ message: 'Invalid Tree node id' });
            return
        }
        console.log({ treeNodeId, name });

        console.log("Downloading avatar...");
        const treeNodeRepository = new TreeNodeRepository()
        const treeNode = await treeNodeRepository.deleteForUser(treeNodeId, (req as any).user.userId)
        if (!treeNode.acknowledged)
            return res.status(500).send()

        res.status(200).json(treeNode)
        console.log('------------end------------')
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
})

export { router as treeNodeRoutes };
