import express from 'express';
import { likeObjectId } from '../../DB/common_schemas';
import { auth } from '../../middlewares/auth';
import { Leaf, LeafUpdate } from '../../DB/models/Leaf';
import LeafRepository from '../../DB/repositories/LeafRepository';
import TreeNodeRepository from '../../DB/repositories/TreeNodeRepository';
import { MongoDB } from '../../DB/mongodb';
import { MEILI_LEAF } from '../../DB/meilisearch';
import { meili } from '../..';
import { handleError, validate } from '../../lib';
import { getLogger, runWithLogger } from '../../observability/requestLoggerContext';
import { authorizeAllowedContentTypes, authorizeCardsPerCategory, authorizeContentsPerCardSide, authorizeValuePerContent } from '../../middlewares/authorization';
import { leafContentAddSchema, leafContentValueAddSchema, leafContentValueDeleteSchema, leafGetSchema, leafListSchema, leafPostSchema, leafUpdateSchema } from './schemas';
import { convertToPlanContentType } from '../../DB/models/Plan';
import { valueExists } from './lib';

const router = express.Router();

router.use(auth)

router.post('/', async (req, res) => {
    let log = getLogger().child({ module: 'leaf', route: 'POST /api/leaf' });

    let db: MongoDB | undefined = undefined
    try {
        log.info('leaf create request received');

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

        if ((await authorizeCardsPerCategory(req, leaf.treeNodeId, 1, res)) !== true) {
            log.info("user exceeded plan limit for card creation")
            return
        }

        log.info("inserting new leaf")
        const insertLeafResult = await runWithLogger(log, () => leafRepository.insert({ ...leaf, definitionContents: [], termContents: [], userId }))
        log.debug({ insertLeafResult })
        if (!insertLeafResult.acknowledged) {
            log.warn("failed to create a leaf record in db")
            return res.status(500).json({ status: 'error', status_code: 'INTERNAL_ERROR' })
        }

        log.info("add title to meilisearch")
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
        log.debug({ meilisearchResult: result })
        if (result.status !== 'succeeded') {
            log.error("failed to add title to meilisearch")
            return res.status(500).json({ status: 'error', status_code: 'INTERNAL_ERROR' })
        }

        await db.commitTransaction()

        res.status(201).json({ status: 'success', data: { id: insertLeafResult.insertedId.toString() } })
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
})

router.get('/', async (req, res) => {
    let log = getLogger().child({ module: 'leaf', route: 'GET /api/leaf' });

    try {
        log.info('leaf request received');

        log.debug({ body: req.body });
        const { parentTreeNodeId, leafId } = await runWithLogger(log, () => validate(leafGetSchema, req.body))
        log.info('input validated');
        log.debug({ parentTreeNodeId, leafId });

        const userId = req.user!.userId;
        log.debug({ userId });

        const leafRepository = new LeafRepository()

        if (parentTreeNodeId) {
            log.info('fetching leafs');
            let leafs: Leaf[] = await leafRepository.getManyForUserByParentTreeNodeId(parentTreeNodeId!, req.user!.userId)
            log.debug({ leafs });
            if (!leafs) {
                log.info('no leafs found');
                return res.status(404).json({ status: 'error', error_code: 'LEAF_NOT_FOUND' })
            }
            res.status(200).json({ status: 'success', data: leafs })
        } else {
            log.info('fetching leaf');
            let leaf: Leaf = await leafRepository.getForUser(leafId!, req.user!.userId)
            log.debug({ leaf });
            if (!leaf) {
                log.info('no leaf found');
                return res.status(404).json({ status: 'error', error_code: 'LEAF_NOT_FOUND' })
            }
            res.status(200).json({ status: 'success', data: leaf })
        }

        res.status(500).json({ status: 'error', status_code: 'INTERNAL_ERROR' })
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
})

router.get('/list', async (req, res) => {
    let log = getLogger().child({ module: 'leaf', route: 'GET /api/leaf/list' });

    try {
        log.info('leaf list request received');

        log.debug({ body: req.body });
        const { parentId, search, limit, skip } = await runWithLogger(log, () => validate(leafListSchema, req.body))
        log.info('input validated');
        log.debug({ parentId, search, limit, skip });

        const userId = req.user!.userId;
        log.debug({ userId });

        let ids: string[] = []
        if (search?.trim()) {
            log.info('searching in meilisearch')

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
            log.debug({ ids }, 'found these ids')
        }

        const leafRepository = new LeafRepository()

        log.info('fetching')
        let leafs
        if (ids.length > 0)
            leafs = await runWithLogger(log, () => leafRepository.getManyForUserByParentTreeNodeIdLimitedByIds(ids, parentId, userId))
        else
            leafs = await runWithLogger(log, () => leafRepository.getForUserPaginated(req.user!.userId, parentId, limit, skip, search))

        res.status(200).json({ status: 'success', data: leafs })
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
})

router.post('/content', async (req, res) => {
    let log = getLogger().child({ module: 'leaf', route: 'POST /api/leaf/content' });

    try {
        log.info('leaf add content request received');

        log.debug({ body: req.body });
        const { type, isTerm, leafId, atIndex } = await runWithLogger(log, () => validate(leafContentAddSchema, req.body))
        log.info('input validated');
        log.debug({ type, isTerm, leafId, atIndex });

        const userId = req.user!.userId;
        log.debug({ userId });

        if ((await authorizeContentsPerCardSide(req, leafId, isTerm, 1, res)) !== true || (await authorizeAllowedContentTypes(req, convertToPlanContentType(type), res)) !== true) {
            log.info("user exceeded plan limit for content creation")
            return
        }

        const leafRepository = new LeafRepository()
        const updateResult = await leafRepository.addContentForUser(userId, leafId, isTerm, type, atIndex)
        console.log({ updateResult })
        if (!updateResult.acknowledged) {
            log.info('failed to add content')
            return res.status(500).json({ status: 'error', status_code: 'INTERNAL_ERROR' })
        }
        if (updateResult.acknowledged && updateResult.matchedCount === 0) {
            log.info("leaf doesn't belong to user or it doesn't exist")
            return res.status(403).json({ status: 'error', status_code: 'FORBIDDEN' })
        }

        log.info('content created successfully')
        return res.status(204).json({ status: 'success' })
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
})

router.delete('/content', async (req, res) => {
    let log = getLogger().child({ module: 'leaf', route: 'DELETE /api/leaf/content' });

    let db: MongoDB | undefined = undefined
    try {
        log.info('leaf delete content request received');

        log.debug({ body: req.body });
        const { type, isTerm, leafId, atIndex } = await runWithLogger(log, () => validate(leafContentAddSchema, req.body))
        log.info('input validated');
        log.debug({ type, isTerm, leafId, atIndex });

        const userId = req.user!.userId;
        log.debug({ userId });

        db = MongoDB.getDbInstance()
        const session = await db.startTransaction()

        const leafRepository = new LeafRepository()
        leafRepository.setTransactionSession(session)

        const leaf = await runWithLogger(log, () => leafRepository.getForUser(userId, leafId))
        log.debug({ leaf })
        if (!leaf) {
            log.info('leaf not found')
            await db.abortTransaction()
            return res.status(404).json({ status: 'error', status_code: 'LEAF_NOT_FOUND' })
        }

        const contentsKey = isTerm ? 'termContents' : 'definitionContents';
        const update: LeafUpdate = { _id: leafId, [contentsKey]: [] }
        update[contentsKey] = leaf[contentsKey].filter((e, i) => i !== atIndex)

        const updateResult = await leafRepository.updateForUser(update, userId)
        console.log({ updateResult })
        if (!updateResult.acknowledged) {
            log.info('failed to delete content')
            await db.abortTransaction()
            return res.status(500).json({ status: 'error', status_code: 'INTERNAL_ERROR' })
        }
        if (updateResult.acknowledged && updateResult.matchedCount === 0) {
            log.info("leaf doesn't belong to user or it doesn't exist")
            await db.abortTransaction()
            return res.status(403).json({ status: 'error', status_code: 'FORBIDDEN' })
        }

        await db.commitTransaction()

        log.info('content deleted successfully')
        return res.status(204).json({ status: 'success' })
    } catch (err) {
        await db?.abortTransaction()
        runWithLogger(log, () => handleError(res, err))
    }
})

router.post('/content/value', async (req, res) => {
    let log = getLogger().child({ module: 'leaf', route: 'POST /api/leaf/content/value' });

    try {
        log.info('leaf add content value request received');

        log.debug({ body: req.body });
        const { type, isTerm, leafId, value, atContentIndex, atContentValueIndex } = await runWithLogger(log, () => validate(leafContentValueAddSchema, req.body))
        log.info('input validated');
        log.debug({ type, isTerm, leafId, value, atContentIndex, atContentValueIndex });

        const userId = req.user!.userId;
        log.debug({ userId });

        if (!(await runWithLogger(log, () => valueExists(userId, type, value)))) {
            log.info('content value not found')
            return res.status(404).json({ status: 'error', status_code: 'CONTENT_VALUE_NOT_FOUND' })
        }

        const leafRepository = new LeafRepository()
        const leaf = await runWithLogger(log, () => leafRepository.getForUser(userId, leafId))
        log.debug({ leaf })
        if (!leaf) {
            log.info('leaf not found')
            return res.status(404).json({ status: 'error', status_code: 'LEAF_NOT_FOUND' })
        }

        const contentsKey = isTerm ? 'termContents' : 'definitionContents';
        if (leaf[contentsKey].length >= atContentIndex) {
            log.info('content not found')
            return res.status(404).json({ status: 'error', status_code: 'CONTENT_NOT_FOUND' })
        }

        if ((await authorizeContentsPerCardSide(req, leafId, isTerm, 1, res)) !== true || (await authorizeValuePerContent(req, leafId, isTerm, convertToPlanContentType(type), leaf[contentsKey][atContentIndex].value.length, res, 1)) !== true) {
            log.info("user exceeded plan limit for content creation")
            return
        }

        const updateResult = await runWithLogger(log, () => leafRepository.addContentValueForUser(userId, leafId, isTerm, type, atContentIndex, value, atContentValueIndex))
        log.debug({ updateResult })
        if (!updateResult.acknowledged) {
            log.info('failed to add content')
            return res.status(500).json({ status: 'error', status_code: 'INTERNAL_ERROR' })
        }
        if (updateResult.acknowledged && updateResult.matchedCount === 0) {
            log.info("leaf doesn't belong to user or it doesn't exist")
            return res.status(403).json({ status: 'error', status_code: 'FORBIDDEN' })
        }

        log.info('content value created successfully')
        return res.status(204).json({ status: 'success' })
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
    }
})

router.delete('/content/value', async (req, res) => {
    let log = getLogger().child({ module: 'leaf', route: 'DELETE /api/leaf/content/value' });

    let db: MongoDB | undefined = undefined
    try {
        log.info('leaf delete content value request received');

        log.debug({ body: req.body });
        const { type, isTerm, leafId, atContentIndex, atContentValueIndex } = await runWithLogger(log, () => validate(leafContentValueDeleteSchema, req.body))
        log.info('input validated');
        log.debug({ type, isTerm, leafId, atContentIndex, atContentValueIndex });

        const userId = req.user!.userId;
        log.debug({ userId });

        db = MongoDB.getDbInstance()
        const session = await db.startTransaction()

        const leafRepository = new LeafRepository()
        leafRepository.setTransactionSession(session)

        const leaf = await runWithLogger(log, () => leafRepository.getForUser(userId, leafId))
        log.debug({ leaf })
        if (!leaf) {
            log.info('leaf not found')
            await db.abortTransaction()
            return res.status(404).json({ status: 'error', status_code: 'LEAF_NOT_FOUND' })
        }

        const contentsKey = isTerm ? 'termContents' : 'definitionContents';
        if (leaf[contentsKey].length >= atContentIndex) {
            log.info('content not found')
            await db.abortTransaction()
            return res.status(404).json({ status: 'error', status_code: 'CONTENT_NOT_FOUND' })
        }

        if (leaf[contentsKey][atContentIndex].value.length >= atContentValueIndex) {
            log.info('content not found')
            await db.abortTransaction()
            return res.status(404).json({ status: 'error', status_code: 'CONTENT_VALUE_NOT_FOUND' })
        }

        const update: LeafUpdate = { _id: leafId, [contentsKey]: [] }
        update[contentsKey] = leaf[contentsKey]
        update[contentsKey][atContentIndex].value = update[contentsKey][atContentIndex].value.filter((_, i) => i !== atContentValueIndex)

        const updateResult = await runWithLogger(log, () => leafRepository.updateForUser(update, userId))
        log.debug({ updateResult })
        if (!updateResult.acknowledged) {
            log.info('failed to delete content')
            await db.abortTransaction()
            return res.status(500).json({ status: 'error', status_code: 'INTERNAL_ERROR' })
        }
        if (updateResult.acknowledged && updateResult.matchedCount === 0) {
            log.info("leaf doesn't belong to user or it doesn't exist")
            await db.abortTransaction()
            return res.status(403).json({ status: 'error', status_code: 'FORBIDDEN' })
        }

        await db.commitTransaction()

        log.info('content value deleted successfully')
        return res.status(204).json({ status: 'success' })
    } catch (err) {
        await db?.abortTransaction()
        runWithLogger(log, () => handleError(res, err))
    }
})

router.patch('/', async (req, res) => {
    let log = getLogger().child({ module: 'leaf', route: 'PATCH /api/leaf/' });

    try {
        log.info('leaf delete content value request received');

        log.debug({ body: req.body });
        const { title, leafId } = await runWithLogger(log, () => validate(leafUpdateSchema, req.body))
        log.info('input validated');
        log.debug({ title, leafId });

        const userId = req.user!.userId;
        log.debug({ userId });

        const leafRepository = new LeafRepository()

        log.info('updating leaf')
        const updateResult = await leafRepository.updateForUser({ _id: leafId, title }, userId)
        log.debug({ updateResult })
        if (!updateResult.acknowledged) {
            log.warn('failed to update card')
            return res.status(500).json({ status: 'error', status_code: 'INTERNAL_ERROR' })
        }
        if (updateResult.acknowledged && updateResult.matchedCount === 0) {
            log.info("card not found or it doesn't belong to user")
            return res.status(403).json({ status: 'error', status_code: 'FORBIDDEN' })
        }

        log.info("updating title in meilisearch")
        const index = meili.index(MEILI_LEAF)
        const task = await index.updateDocuments([{
            _id: leafId,
            title: title,
            updatedAt: new Date().toISOString()
        }])
        const result = await index.tasks.waitForTask(task.taskUid)
        log.debug({ result })
        if (result.status !== 'succeeded') {
            console.error(result)
            return res.status(500).send()
        }

        log.info("successfully updated card")
        res.status(204).json({ status: 'success' })
    } catch (err) {
        runWithLogger(log, () => handleError(res, err))
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
