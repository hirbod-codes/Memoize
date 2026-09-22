import express from 'express';
import { likeObjectId } from '../DB/common_schemas';
import { auth } from '../middlewares/auth';
import { Leaf, LeafPost, leafPostSchema, LeafUpdate, leafUpdateSchema } from '../DB/models/Leaf';
import LeafRepository from '../DB/repositories/LeafRepository';
import { number, string, ValidationError } from 'yup';
import TreeNodeRepository from '../DB/repositories/TreeNodeRepository';
import { MongoDB } from '../DB/mongodb';
import { MEILI_LEAF } from '../DB/meilisearch';
import { meili } from '..';
import { validate } from '../lib';
import { getLogger, runWithLogger } from '../observability/requestLoggerContext';

const router = express.Router();

router.use(auth)

router.post('/', async (req, res) => {
    let log = getLogger().child({ module: 'video', route: 'POST /api/leaf' });


    let db: MongoDB | undefined = undefined
    try {
        log.info('Video upload request received');

        log.debug({ body: req.body });
        const leaf = await runWithLogger(log, () => validate(leafPostSchema, req.body))
        log.info('input validated');
        log.debug({ leaf });

        const userId = req.user!.userId;
        log.debug({ userId });

        db = MongoDB.getDbInstance()
        const session = await db.startTransaction()

        const leafRepository = new LeafRepository()
        leafRepository.setTransactionSession(session)

        const treeNodeRepository = new TreeNodeRepository()
        treeNodeRepository.setTransactionSession(session)

        const treeNode = await treeNodeRepository.getForUser(leaf.treeNodeId, userId)
        if (!treeNode) {
            log.info("category doesn't belong to user")
            return res.status(403).json({ status: 'error', error_code: 'INVALID_TREENODE_ID' })
        }
        log.info("category belongs to user")

        log.info("inserting new leaf")
        const insertLeafResult = await leafRepository.insert({ ...leaf, definitionContents: [], termContents: [], userId })
        log.debug({ insertLeafResult })
        if (!insertLeafResult.acknowledged) {
            log.warn("failed to create a leaf record in db")
            return res.status(500).json({ status: 'error', status_code: 'INTERNAL_ERROR' })
        }

        const index = meili.index(MEILI_LEAF)
        const task = await index.addDocuments([{
            _id: insertLeafResult.insertedId.toString(),
            userId: req.user!.userId,
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

        res.status(201).json({ status: 'success', data: { id: insertLeafResult.insertedId.toString() } })
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
        let parentTreeNodeId: string | undefined, leafId: string | undefined
        try {
            parentTreeNodeId = await string().optional().label('Parent tree node id').validate(req.query.parentTreeNodeId?.toString())
            leafId = await string().objectIdString().optional().label('Leaf Id').validate(req.query.leafId?.toString())

            if (!parentTreeNodeId && !leafId)
                return res.status(400).json({ errors: ['One of the parentTreeNodeId or leafId query parameters are required.'] })
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ errors: ['Invalid Tree node'] });
        }
        console.log({ parentTreeNodeId });

        const leafRepository = new LeafRepository()

        if (parentTreeNodeId) {
            console.log("fetching leafs...");
            let leafs: Leaf[] = await leafRepository.getManyForUserByParentTreeNodeId(parentTreeNodeId!, req.user!.userId)
            if (!leafs)
                return res.status(404).send()
            res.status(200).json({ status: 'success', data: leafs })
        } else {
            console.log("fetching leaf...");
            let leaf: Leaf = await leafRepository.getForUser(leafId!, req.user!.userId)
            if (!leaf)
                return res.status(404).send()
            res.status(200).json({ status: 'success', data: leaf })
        }

        res.status(500).send()
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

        const userId = req.user!.userId

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
        let leafs
        if (ids.length > 0)
            leafs = await leafRepository.getManyForUserByParentTreeNodeIdLimitedByIds(ids, parentId, userId)
        else
            leafs = await leafRepository.getForUserPaginated(req.user!.userId, parentId, limit, skip, search)

        res.status(200).json({ status: 'success', data: leafs })

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

        const userId = req.user!.userId

        console.log('Replacing updated leaf...')
        const leafRepository = new LeafRepository()
        const updateResult = await leafRepository.updateForUser(leaf, userId)
        console.log({ updateResult })
        if (!updateResult.acknowledged)
            return res.status(500).send()
        if (updateResult.acknowledged && updateResult.matchedCount === 0)
            return res.status(403).send()

        if (leaf.title) {
            console.log("updating title in meilisearch...");

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
        res.status(200).json({ status: 'success' })
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

        console.log("deleting leaf...");
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

        res.status(204).json({ status: 'success' })
        console.log('------------end------------')
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
})

export { router as leafRoutes };
