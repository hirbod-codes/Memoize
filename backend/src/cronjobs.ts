import cron from 'node-cron'
import { VideoFileRepository } from './DB/repositories/VideoFileRepository'
import { AudioFileRepository } from './DB/repositories/AudioFileRepository'
import { ImageRepository } from './DB/repositories/ImageRepository'
import VideoRepository from './DB/repositories/VideoRepository'
import { CoverArtRepository } from './DB/repositories/CoverArtRepository'
import { AvatarRepository } from './DB/repositories/AvatarRepository'
import { ThumbnailRepository } from './DB/repositories/ThumbnailRepository'
import TreeNodeRepository from './DB/repositories/TreeNodeRepository'
import LeafRepository from './DB/repositories/LeafRepository'
import { Content, Leaf } from './DB/models/Leaf'

export const runCronjobs = async () => {
    // Schedule: every 12 hours
    // "0 0 */12 * * *" => second, minute, hour, day, month, weekday
    cron.schedule('0 0 */12 * * *', async () => {
        console.log('Sending delete requests for temporary contents...');

        const videoFileRepo = new VideoFileRepository()
        const thumbnailRepo = new ThumbnailRepository()
        const videoRepo = new VideoRepository()
        const audioFileRepo = new AudioFileRepository()
        const coverArtRepo = new CoverArtRepository()
        const imageRepo = new ImageRepository()
        const avatarRepo = new AvatarRepository()
        const treeNodeRepo = new TreeNodeRepository()
        const leafRepo = new LeafRepository()

        const formateRemovableIds = (leaf: Leaf) => {
            const formatted: { imageId: string[], audioId: string[], videoId: string[] } = { imageId: [], audioId: [], videoId: [] }

            for (const content of leaf.termContents)
                for (const v of content.value)
                    if (content.type === 'string' || content.type === 'richText')
                        continue
                    else
                        switch (content.type) {
                            case 'audioId':
                                formatted.audioId.push(v)
                                break;

                            case 'imageId':
                                formatted.imageId.push(v)
                                break;

                            case 'videoId':
                                formatted.videoId.push(v)
                                break;

                            default:
                                break;
                        }

            return formatted
        }

        const runDeleteLeafPromises = (leaf: Leaf) => {
            const formatted = formateRemovableIds(leaf)

            imageRepo.deleteFileBulk(formatted.imageId)
                .then(imageResult => console.log('imageResult', imageResult))
                .catch(e => console.error(e))

            audioFileRepo.deleteFileBulk(formatted.audioId)
                .then(audioFileResult => console.log('audioFileResult', audioFileResult))
                .catch(e => console.error(e))

            for (const id of formatted.audioId)
                coverArtRepo.deleteFileByAudioId(id)
                    .then(coverArtResult => console.log('coverArtResult', coverArtResult))
                    .catch(e => console.error(e))

            videoRepo.deleteBulk(formatted.videoId)
                .then(videoResult => console.log('videoResult', videoResult))
                .catch(e => console.error(e))

            for (const id of formatted.videoId) {
                videoFileRepo.deleteFileByVideoId(id)
                    .then(videoFileResult => console.log('videoFileResult', videoFileResult))
                    .catch(e => console.error(e))

                thumbnailRepo.deleteFileByVideoId(id)
                    .then(thumbnailResult => console.log('thumbnailResult', thumbnailResult))
                    .catch(e => console.error(e))
            }
        }

        const makeContentPermanent = async (content: Content) => {
            if (content.type === 'richText' || content.type === 'string')
                return

            for (const v of content.value)
                switch (content.type) {
                    case 'audioId':
                        audioFileRepo.makePermanent(v)
                            .then(coverArtResult => console.log('coverArtResult', coverArtResult))
                            .catch(e => console.error(e))

                        coverArtRepo.makePermanentByAudioId(v)
                            .then(coverArtResult => console.log('coverArtResult', coverArtResult))
                            .catch(e => console.error(e))
                        break;

                    case 'videoId':
                        videoRepo.makePermanent(v)
                            .then(coverArtResult => console.log('coverArtResult', coverArtResult))
                            .catch(e => console.error(e))

                        videoFileRepo.makePermanentByVideoId(v)
                            .then(coverArtResult => console.log('coverArtResult', coverArtResult))
                            .catch(e => console.error(e))

                        thumbnailRepo.makePermanentByVideoId(v)
                            .then(coverArtResult => console.log('coverArtResult', coverArtResult))
                            .catch(e => console.error(e))
                        break;

                    case 'imageId':
                        imageRepo.makePermanent(v)
                            .then(coverArtResult => console.log('coverArtResult', coverArtResult))
                            .catch(e => console.error(e))
                        break;

                    default:
                        break;
                }
        }

        console.log('Deleting orphan tree nodes...');
        let treeNodeCursor = treeNodeRepo.getFromCursor(Date.now() - (14 * 60 * 60))
        for await (const treeNode of treeNodeCursor) {
            if (treeNode.root)
                continue
            let result = await treeNodeRepo.hasParent(treeNode._id.toString())
            if (result !== true)
                treeNodeRepo.delete(treeNode._id.toString())
                    .then(r => console.log(`delete result for tree node id:${treeNode._id.toString()}`, r))
                    .catch(e => console.error(e))
        }

        console.log('Deleting orphan leafs...');
        treeNodeCursor = treeNodeRepo.getFromCursor(Date.now() - (14 * 60 * 60))
        let leafCursor = leafRepo.getFromCursor(Date.now() - (14 * 60 * 60))
        for await (const leaf of leafCursor) {
            let result = false
            for await (const treeNode of treeNodeCursor) {
                result = await treeNodeRepo.hasLeaf(treeNode._id.toString(), leaf._id.toString())
                if (result)
                    break;
            }

            if (!result)
                runDeleteLeafPromises(leaf)
        }

        console.log('Make leaf\'s contents permanent...');
        leafCursor = leafRepo.getFromCursor(Date.now() - (14 * 60 * 60))
        for await (const leaf of leafCursor)
            for (const content of leaf.termContents)
                makeContentPermanent(content)

        console.log('Deleting temporary files...');
        videoFileRepo.deleteTemporaryFiles()
            .then(videoFileRepoDeleteResult => console.log({ videoFileRepoDeleteResult }))
            .catch(e => console.error(e))

        thumbnailRepo.deleteTemporaryFiles()
            .then(thumbnailRepoDeleteResult => console.log({ thumbnailRepoDeleteResult }))
            .catch(e => console.error(e))

        videoRepo.deleteTemporaries()
            .then(videoRepoDeleteResult => console.log({ videoRepoDeleteResult }))
            .catch(e => console.error(e))

        audioFileRepo.deleteTemporaryFiles()
            .then(audioFileRepoDeleteResult => console.log({ audioFileRepoDeleteResult }))
            .catch(e => console.error(e))

        coverArtRepo.deleteTemporaryFiles()
            .then(coverArtRepoDeleteResult => console.log({ coverArtRepoDeleteResult }))
            .catch(e => console.error(e))

        imageRepo.deleteTemporaryFiles()
            .then(imageRepoDeleteResult => console.log({ imageRepoDeleteResult }))
            .catch(e => console.error(e))

        avatarRepo.deleteTemporaryFiles()
            .then(avatarRepoDeleteResult => console.log({ avatarRepoDeleteResult }))
            .catch(e => console.error(e))

        console.log('done');
    })

    console.log('Cron jobs scheduled')
}