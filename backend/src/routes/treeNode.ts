import express from 'express';
import { likeObjectId } from '../DB/common_schemas';
import { auth } from '../middlewares/auth';
import { TreeNode, TreeNodeCreate, treeNodeCreateSchema, treeNodeSchema, TreeNodeUpdate, treeNodeUpdateSchema } from '../DB/models/TreeNode';
import TreeNodeRepository from '../DB/repositories/TreeNodeRepository';
import { array, string } from 'yup';

const router = express.Router();

router.use(auth)

router.post('/', async (req, res) => {
    try {
        console.log('/api/treeNode', 'POST')

        console.log('Validation...')
        let treeNode: TreeNodeCreate
        try {
            treeNode = req.body.treeNode

            if (!treeNodeCreateSchema.required().isValidSync(treeNode))
                return res.status(400).json({ message: 'Invalid Tree node' });
            
            treeNode = treeNodeCreateSchema.cast(treeNode, { stripUnknown: true })
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

router.get('/children', async (req, res) => {
    try {
        console.log('/api/treeNode/children')

        console.log('Validation...')
        let parentTreeNodeId: string | undefined
        try {
            let parentTreeNodeId = req.query.parentTreeNodeId?.toString()
            if (!likeObjectId.required().isValidSync(parentTreeNodeId)) {
                res.status(400).json({ message: 'Invalid Tree node ids' });
                return
            }
        } catch (err) {
            res.status(400).json({ message: 'Invalid Tree node ids' });
            return
        }
        console.log({ parentTreeNodeId });

        console.log("fetching...");
        const treeNodeRepository = new TreeNodeRepository()
        const treeNode = await treeNodeRepository.getByParentIdForUser(parentTreeNodeId!, (req as any).user.userId)
        if (!treeNode)
            return res.status(404).send()

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

router.put('/', async (req, res) => {
    try {
        console.log('/api/treeNode', 'PUT')

        console.log('Validation...')
        let treeNode: TreeNodeUpdate
        try {
            treeNode = req.body.treeNode

            if (!treeNodeUpdateSchema.required().isValidSync(treeNode) || !treeNode._id)
                return res.status(400).json({ message: 'Invalid Tree node' });

            treeNode = treeNodeUpdateSchema.cast(treeNode, { stripUnknown: true })
        } catch (err) {
            res.status(400).json({ message: 'Invalid Tree node' });
            return
        }
        console.log({ treeNode });

        const treeNodeRepository = new TreeNodeRepository()

        const userId = (req as any).user.userId

        console.log("Replacing new treeNode...");
        const insertTreeNodeResult = await treeNodeRepository.replaceForUser(treeNode, userId)
        console.log("Insert result", insertTreeNodeResult);
        if (!insertTreeNodeResult.acknowledged)
            return res.status(500).send()
        if (insertTreeNodeResult.acknowledged && insertTreeNodeResult.matchedCount === 0)
            return res.status(403).send()

        res.status(201).json({ id: treeNode._id!.toString() })
        console.log('------------end------------')
    } catch (err) {
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

        console.log("Deleting tree node...");
        const treeNodeRepository = new TreeNodeRepository()
        const treeNode = await treeNodeRepository.deleteForUser(treeNodeId, (req as any).user.userId)
        if (!treeNode.acknowledged)
            return res.status(500).send()

        res.status(200).send()
        console.log('------------end------------')
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
})

export { router as treeNodeRoutes };
