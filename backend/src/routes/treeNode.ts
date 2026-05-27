import express from 'express';
import { auth } from '../middlewares/auth';
import { TreeNodePost, treeNodePostSchema, TreeNodeUpdate, treeNodeUpdateSchema } from '../DB/models/TreeNode';
import TreeNodeRepository from '../DB/repositories/TreeNodeRepository';
import { array, number, string, ValidationError } from 'yup';
import { meili } from '..';
import { MEILI_TREE_NODE } from '../DB/meilisearch';

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
        if (!treeNode.parentId)
            treeNode.parentId = undefined

        const treeNodeRepository = new TreeNodeRepository()

        const userId = (req as any).user.userId

        console.log("Inserting new treeNode...");
        const insertTreeNodeResult = await treeNodeRepository.insert({ ...treeNode, userId, leafIds: [], treeNodeIds: [] })
        console.log("Insert result", insertTreeNodeResult);
        if (!insertTreeNodeResult.acknowledged)
            return res.status(500).send()

        console.log("Inserting new meili treeNode...");
        const index = meili.index(MEILI_TREE_NODE)
        index.addDocuments([{
            id: insertTreeNodeResult.insertedId.toString(),
            userId: (req as any).user.userId,
            parentId: treeNode.parentId ?? null,
            title: treeNode.title,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }])

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
        let ids: string[] | undefined
        try {
            let temp = await string().required().label('Tree node id').validate(req.query.ids?.toString())

            ids = await array().min(1).of(string().required().objectIdString()).required().validate(temp.split(',').map(m => m.trim()))
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ ids });

        console.log("fetching...");
        const treeNodeRepository = new TreeNodeRepository()
        const treeNode = await treeNodeRepository.getManyForUser(ids, (req as any).user.userId)
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

router.get('/list', async (req, res) => {
    try {
        console.log('/api/treeNode/list/')

        console.log('Validation...')
        let search: string | undefined, limit: number, skip: number | undefined, parentId: string | undefined
        try {
            search = await string().optional().label('Search input').validate(req.query.search?.toString())
            parentId = await string().optional().objectIdString().label('Parent folder id').validate(req.query.parentId?.toString())
            let l: number = await number().required().integer().min(0).max(100).label('Limit').validate(req.query.limit?.toString())
            let s = await number().optional().label('Skip').validate(req.query.skip?.toString())
            console.log({ l, skip, search })

            limit = typeof l === 'string' ? Number.parseInt(l!, 10) : l
            skip = typeof s === 'string' ? Number.parseInt(s!, 10) : (s ?? 0)
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node ids' });
        }
        console.log({ limit, skip, search, parentId })

        const userId = (req as any).user.userId

        let ids: string[] = []
        if (search?.trim()) {
            console.log('Searching...')

            const index = meili.index(MEILI_TREE_NODE)

            const result = await index.search(search, {
                filter: [
                    `userId = "${userId}"`,
                    parentId ? `parentId = "${parentId}"` : 'parentId IS NULL'
                ],
                limit,
                offset: skip
            })
            console.log(JSON.stringify(result, null, 2))

            ids = result.hits.map(x => x.id)
        }
        console.log({ ids })

        console.log('Fetching...')
        const treeNodeRepository = new TreeNodeRepository()
        let result
        if (search?.trim())
            result = await treeNodeRepository.getManyForUser(ids, userId)
        else
            if (parentId)
                result = await treeNodeRepository.getChildrenForUserPaginated(userId, parentId, limit, skip, search)
            else
                result = await treeNodeRepository.getRootsForUserPaginated(userId, limit, skip, search)

        res.status(200).json(result)

        console.log('------------end------------')

    } catch (err) {
        console.error(err)
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
        if (!treeNode.acknowledged || treeNode.deletedCount === 0)
            return res.status(500).send()

        const index = meili.index(MEILI_TREE_NODE)
        index.deleteDocument(treeNodeId)

        res.status(200).send()
        console.log('------------end------------')
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
})

export { router as treeNodeRoutes };
