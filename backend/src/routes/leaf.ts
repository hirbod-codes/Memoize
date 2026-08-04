import express from 'express';
import { likeObjectId } from '../DB/common_schemas';
import { auth } from '../middlewares/auth';
import { Leaf, LeafPost, leafPostSchema, LeafUpdate, leafUpdateSchema } from '../DB/models/Leaf';
import LeafRepository from '../DB/repositories/LeafRepository';
import { array, number, string, ValidationError } from 'yup';
import TreeNodeRepository from '../DB/repositories/TreeNodeRepository';
import { MongoDB } from '../DB/mongodb';
import { meili } from '..';
import { MEILI_LEAF } from '../DB/meilisearch';

const router = express.Router();

router.use(auth)

router.post('/', async (req, res) => {
    let db: MongoDB | undefined = undefined
    try {
        console.log('/api/leaf', 'POST')

        console.log('Validation...')
        let leaf: LeafPost
        try {
            leaf = await leafPostSchema.required().validate(req.body.leaf, { stripUnknown: true })
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ leaf })

        db = MongoDB.getDbInstance()
        const session = await db.startTransaction()

        const leafRepository = new LeafRepository()
        leafRepository.setTransactionSession(session)

        const treeNodeRepository = new TreeNodeRepository()
        treeNodeRepository.setTransactionSession(session)

        console.log("Authorize...")
        const userId = (req as any).user.userId
        const treeNode = await treeNodeRepository.getForUser(leaf.treeNodeId, userId)
        if (!treeNode)
            return res.status(403).send()

        console.log("Inserting new leaf...")
        const insertLeafResult = await leafRepository.insert({ ...leaf, userId })
        console.log("Insert result", insertLeafResult)
        if (!insertLeafResult.acknowledged)
            return res.status(500).send()

        const index = meili.index(MEILI_LEAF)
        const task = await index.addDocuments([{
            _id: insertLeafResult.insertedId.toString(),
            userId: (req as any).user.userId,
            treeNodeId: leaf.treeNodeId,
            title: leaf.title,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }])
        const result = await index.tasks.waitForTask(task.taskUid)
        if (result.status !== 'succeeded') {
            console.error(result)
            return res.status(500).send()
        }

        await db.commitTransaction()

        res.status(201).json({ id: insertLeafResult.insertedId.toString() })
        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        await db?.abortTransaction()
        res.status(500).json({ message: 'Internal server error' });
    }
})

router.get('/', async (req, res) => {
    try {
        console.log('/api/leaf')

        console.log('Validation...')
        let leafIds: string[] | undefined, parentTreeNodeId: string | undefined
        try {
            parentTreeNodeId = await string().optional().label('Parent tree node id').validate(req.query.parentTreeNodeId?.toString())
            let temp = await string().optional().label('Tree node id').validate(req.query.leafIds?.toString())

            if (!parentTreeNodeId && !temp)
                return res.status(400).json({ errors: ['Invalid data provided'] })

            if (temp)
                leafIds = await array().min(1).of(string().required().objectIdString()).required().validate(temp.split(',').map(m => m.trim()))
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ leafIds });

        console.log("Fetching leafs...");
        const leafRepository = new LeafRepository()
        let leafs: Leaf[]
        if (leafIds)
            leafs = await leafRepository.getManyForUser(leafIds, (req as any).user.userId)
        else
            leafs = await leafRepository.getForUserByParentTreeNode(parentTreeNodeId!, (req as any).user.userId)
        if (!leafs) {
            res.status(404).send()
            return
        }

        res.status(200).json(leafs)
        console.log('------------end------------')
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
})

router.get('/list', async (req, res) => {
    try {
        console.log('/api/leaf/list/')

        console.log('Validation...')
        let search: string | undefined, limit: number, skip: number, parentId: string | undefined
        try {
            search = await string().optional().label('Search input').validate(req.query.search?.toString())
            parentId = await string().required().objectIdString().label('Parent folder id').validate(req.query.parentId?.toString())
            let l: number = await number().required().integer().min(0).max(100).label('Limit').validate(req.query.limit?.toString())
            let s = await number().optional().integer().min(0).label('Skip').validate(req.query.skip?.toString())
            console.log({ l, s, search })

            limit = typeof l === 'string' ? Number.parseInt(l!, 10) : l
            skip = typeof s === 'string' ? Number.parseInt(s!, 10) : (s ?? 0)
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node ids' });
        }
        console.log({ limit, skip, search })

        const userId = (req as any).user.userId

        let ids: string[] = []
        if (search?.trim()) {
            const index = meili.index(MEILI_LEAF)

            const result = await index.search(search, {
                filter: [
                    `userId = "${userId}"`,
                    `treeNodeId = "${parentId}"`
                ],
                limit,
                offset: skip
            })

            ids = result.hits.map(x => x._id)
        }

        console.log('Fetching...')
        const leafRepository = new LeafRepository()
        let result
        if (ids.length > 0)
            result = await leafRepository.getManyForUserByParentTreeNodeIdLimitedByIds(ids, parentId, userId)
        else
            result = await leafRepository.getForUserPaginated((req as any).user.userId, parentId, limit, skip, search)

        res.status(200).json(result)

        console.log('------------end------------')

    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Internal server error' });
    }
})

router.patch('/', async (req, res) => {
    try {
        console.log('/api/leaf')

        console.log('Validation...')
        let leaf: LeafUpdate
        try {
            leaf = await leafUpdateSchema.required().validate(req.body.leaf)
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ leaf: JSON.stringify(leaf, null, 4) });

        const userId = (req as any).user.userId

        console.log('Replacing updated leaf...')
        const leafRepository = new LeafRepository()
        const updateResult = await leafRepository.updateForUser(leaf, userId)
        console.log({ updateResult })
        if (!updateResult.acknowledged)
            return res.status(500).send()
        if (updateResult.acknowledged && updateResult.matchedCount === 0)
            return res.status(403).send()

        if (leaf.title) {
            console.log("Updating title in meilisearch...");

            const index = meili.index(MEILI_LEAF)
            const task = await index.updateDocuments([{
                _id: leaf._id,
                title: leaf.title,
                updatedAt: new Date().toISOString()
            }])
            const result = await index.tasks.waitForTask(task.taskUid)
            if (result.status !== 'succeeded') {
                console.error(result)
                return res.status(500).send()
            }
        }
        res.status(200).send()
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
        console.log({ id });

        console.log("Deleting leaf...");
        const leafRepository = new LeafRepository()
        const leaf = await leafRepository.delete(id)
        if (!leaf.acknowledged || leaf.deletedCount === 0)
            return res.status(500).send()

        const index = meili.index(MEILI_LEAF)
        const task = await index.deleteDocument(id)
        const result = await index.tasks.waitForTask(task.taskUid)
        if (result.status !== 'succeeded') {
            console.error(result)
            return res.status(500).send()
        }

        res.status(200).send()
        console.log('------------end------------')
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
})

export { router as leafRoutes };
