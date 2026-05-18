import express from 'express';
import { likeObjectId } from '../DB/common_schemas';
import { auth } from '../middlewares/auth';
import { Content, Leaf, leafValidationSchema } from '../DB/models/Leaf';
import LeafRepository from '../DB/repositories/LeafRepository';
import { array, string } from 'yup';
import TreeNodeRepository from '../DB/repositories/TreeNodeRepository';
import { MongoDB } from '../DB/mongodb';
import { VideoFileRepository } from '../DB/repositories/VideoFileRepository';
import { ThumbnailRepository } from '../DB/repositories/ThumbnailRepository';
import VideoRepository from '../DB/repositories/VideoRepository';
import { AudioFileRepository } from '../DB/repositories/AudioFileRepository';
import { CoverArtRepository } from '../DB/repositories/CoverArtRepository';
import { ImageRepository } from '../DB/repositories/ImageRepository';
import { AvatarRepository } from '../DB/repositories/AvatarRepository';

const router = express.Router();

router.use(auth)

router.post('/', async (req, res) => {
    let db: MongoDB | undefined = undefined
    try {
        console.log('/api/leaf', 'POST')

        console.log('Validation...')
        let leaf: Leaf, treeNodeId: string | undefined
        try {
            leaf = req.body.leaf
            treeNodeId = req.body.treeNodeId

            leaf.userId = (req as any).user.userId
            if (!leafValidationSchema.required().isValidSync(leaf))
                return res.status(400).json({ message: 'Invalid leaf' });

            if (!string().required().isValidSync(treeNodeId))
                return res.status(400).json({ message: 'Invalid leaf' });
        } catch (err) {
            res.status(400).json({ message: 'Invalid artist id' });
            return
        }
        console.log({ leaf });

        db = MongoDB.getDbInstance()
        const session = await db.startTransaction()

        const leafRepository = new LeafRepository()
        leafRepository.setTransactionSession(session)

        const treeNodeRepository = new TreeNodeRepository()
        treeNodeRepository.setTransactionSession(session)

        console.log("Fetching the tree node...");
        const treeNode = await treeNodeRepository.get(treeNodeId)
        if (!treeNode)
            return res.status(404).send()

        console.log("Inserting new leaf...");
        const insertLeafResult = await leafRepository.insert(leaf)
        console.log("Insert result", insertLeafResult);
        if (!insertLeafResult.acknowledged)
            return res.status(500).send()

        console.log("Add new leaf to tree node...");
        const addToTreeNodeResult = await treeNodeRepository.addLeaf(treeNodeId, insertLeafResult.insertedId.toString())
        console.log("add result", addToTreeNodeResult);
        if (!addToTreeNodeResult.acknowledged)
            return res.status(500).send()

        const videoFileRepo = new VideoFileRepository()
        videoFileRepo.setTransactionSession(session)

        const thumbnailRepo = new ThumbnailRepository()
        thumbnailRepo.setTransactionSession(session)

        const videoRepo = new VideoRepository()
        videoRepo.setTransactionSession(session)

        const audioRepo = new AudioFileRepository()
        audioRepo.setTransactionSession(session)

        const audioFileRepo = new AudioFileRepository()
        audioFileRepo.setTransactionSession(session)

        const coverArtRepo = new CoverArtRepository()
        coverArtRepo.setTransactionSession(session)

        const imageRepo = new ImageRepository()
        imageRepo.setTransactionSession(session)

        const avatarRepo = new AvatarRepository()
        avatarRepo.setTransactionSession(session)

        const makePermanent = async (content: Content) => {
            switch (content.type) {
                case 'imageId':
                    for (const id of content.value) {
                        const imageMakePermanentResult = await imageRepo.makePermanent(id)
                        if (imageMakePermanentResult === false || !imageMakePermanentResult.acknowledged) {
                            await db?.abortTransaction()
                            return res.status(500).send()
                        }
                    }
                    break;

                case 'videoId':
                    for (const id of content.value) {
                        const videoMakePermanentResult = await videoRepo.makePermanent(id)
                        if (!videoMakePermanentResult.acknowledged) {
                            await db?.abortTransaction()
                            return res.status(500).send()
                        }
                        const videoFileMakePermanentResult = await videoFileRepo.makePermanentByVideoId(id)
                        if (videoFileMakePermanentResult === false || !videoFileMakePermanentResult.acknowledged) {
                            await db?.abortTransaction()
                            return res.status(500).send()
                        }
                        const thumbnailMakePermanentResult = await thumbnailRepo.makePermanentByVideoId(id)
                        if (thumbnailMakePermanentResult === false || !thumbnailMakePermanentResult.acknowledged) {
                            await db?.abortTransaction()
                            return res.status(500).send()
                        }
                    }
                    break;

                case 'audioId':
                    for (const id of content.value) {
                        const audioMakePermanentResult = await audioRepo.makePermanent(id)
                        if (audioMakePermanentResult === false || !audioMakePermanentResult.acknowledged) {
                            await db?.abortTransaction()
                            return res.status(500).send()
                        }
                        const audioFileMakePermanentResult = await audioFileRepo.makePermanentByAudioId(id)
                        if (audioFileMakePermanentResult === false || !audioFileMakePermanentResult.acknowledged) {
                            await db?.abortTransaction()
                            return res.status(500).send()
                        }
                        const coverArtMakePermanentResult = await coverArtRepo.makePermanentByAudioId(id)
                        if (coverArtMakePermanentResult === false || !coverArtMakePermanentResult.acknowledged) {
                            await db?.abortTransaction()
                            return res.status(500).send()
                        }
                    }
                    break;

                default:
                    break;
            }
        }

        for (const content of leaf.termContents)
            makePermanent(content)

        for (const content of leaf.definitionContents)
            makePermanent(content)

        await db.commitTransaction()

        res.status(201).json({ id: insertLeafResult.insertedId.toString() })
        console.log('------------end------------')
    } catch (err) {
        await db?.abortTransaction()
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
