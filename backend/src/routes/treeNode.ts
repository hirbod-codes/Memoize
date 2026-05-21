import express from 'express';
import { auth } from '../middlewares/auth';
import { TreeNodePost, treeNodePostSchema, TreeNodeUpdate, treeNodeUpdateSchema } from '../DB/models/TreeNode';
import TreeNodeRepository from '../DB/repositories/TreeNodeRepository';
import { array, string, ValidationError } from 'yup';

const router = express.Router();

router.use(auth)

router.post('/', async (req, res) => {
    try {
        console.log('/api/treeNode', 'POST')

        console.log('Validation...')
        let treeNode: TreeNodePost
        try {
            treeNode = await treeNodePostSchema.required().stripNull().stripUndefined().validate(req.body.treeNode, { stripUnknown: true })
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ treeNode });

        const treeNodeRepository = new TreeNodeRepository()

        const userId = (req as any).user.userId

        console.log("Inserting new treeNode...");
        const insertTreeNodeResult = await treeNodeRepository.insert({ ...treeNode, userId, leafIds: [], treeNodeIds: [] })
        console.log("Insert result", insertTreeNodeResult);
        if (!insertTreeNodeResult.acknowledged)
            return res.status(500).send()

        res.status(201).json({ id: insertTreeNodeResult.insertedId.toString() })
        console.log('------------end------------')
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
})

router.get('/', async (req, res) => {
    try {
        console.log('/api/treeNode')

        console.log('Validation...')
        let treeNodeIds: string[] | undefined
        try {
            let temp = await string().required().label('Tree node id').validate(req.query.treeNodeIds?.toString())

            treeNodeIds = await array().min(1).of(string().required().objectIdString()).required().validate(temp.split(',').map(m => m.trim()))
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
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
            parentTreeNodeId = await string().required().objectIdString().validate(req.query.parentTreeNodeId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node ids' });
        }
        console.log({ parentTreeNodeId });

        console.log("fetching...");
        const treeNodeRepository = new TreeNodeRepository()
        const treeNode = await treeNodeRepository.getByParentIdForUser(parentTreeNodeId, (req as any).user.userId)
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

router.patch('/', async (req, res) => {
    try {
        console.log('/api/treeNode', 'PATCH')

        console.log('Validation...')
        let treeNode: TreeNodeUpdate
        try {
            treeNode = await treeNodeUpdateSchema.required().validate(req.body.treeNode, { stripUnknown: true })
            console.log({ treeNode });
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }

        const treeNodeRepository = new TreeNodeRepository()

        const userId = (req as any).user.userId

        console.log("Replacing new treeNode...");
        const insertTreeNodeResult = await treeNodeRepository.replaceForUser(treeNode, userId)
        console.log("Insert result", insertTreeNodeResult);
        if (!insertTreeNodeResult.acknowledged)
            return res.status(500).send()
        if (insertTreeNodeResult.acknowledged && insertTreeNodeResult.matchedCount === 0)
            return res.status(403).send()

        res.status(200).json({ id: treeNode._id!.toString() })
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
            treeNodeId = await string().required().objectIdString().validate(req.query.treeNodeId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node id' });
        }
        console.log({ treeNodeId });

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
