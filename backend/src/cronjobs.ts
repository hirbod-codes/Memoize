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


        const makeContentPermanent = async (content: Content) => {
            if (content.type === 'richText' || content.type === 'string')
                return

            for (const v of content.value)
                if (v)
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

        // To do: delete dangling contents
        // To do: delete content ids that don't exist
        const deleteVideo = (videoId: string) => {
            console.log(`Deleting video id: ${videoId} ...`);

            videoRepo.delete(videoId)
                .then(videoRepoDeleteResult => console.log({ videoRepoDeleteResult }))
                .catch(e => console.error(e))

            videoFileRepo.deleteFileByVideoId(videoId)
                .then(videoFileRepoDeleteResult => console.log({ videoFileRepoDeleteResult }))
                .catch(e => console.error(e))

            thumbnailRepo.deleteFileByVideoId(videoId)
                .then(thumbnailRepoDeleteResult => console.log({ thumbnailRepoDeleteResult }))
                .catch(e => console.error(e))
        }

        const deleteAudio = async (audioId: string) => {
            console.log(`Deleting audio id: ${audioId} ...`);

            audioFileRepo.deleteFile(audioId)
                .then(audioFileRepoDeleteResult => console.log({ audioFileRepoDeleteResult }))
                .catch(e => console.error(e))

            coverArtRepo.deleteFileByAudioId(audioId)
                .then(coverArtRepoDeleteResult => console.log({ coverArtRepoDeleteResult }))
                .catch(e => console.error(e))
        }

        const deleteImage = async (imageId: string) => {
            console.log(`Deleting image id: ${imageId} ...`);

            imageRepo.deleteFile(imageId)
                .then(videoFileRepoDeleteResult => console.log({ videoFileRepoDeleteResult }))
                .catch(e => console.error(e))
        }

        const deleteThumbnail = async (thumbnailId: string) => {
            console.log(`Deleting thumbnail id: ${thumbnailId} ...`);

            thumbnailRepo.deleteFile(thumbnailId)
                .then(thumbnailRepoDeleteResult => console.log({ thumbnailRepoDeleteResult }))
                .catch(e => console.error(e))
        }

        const from = Date.now() - (14 * 60 * 60)

        console.log('Make leaf\'s contents permanent...');
        const leafCursor = leafRepo.getFromCursor(from)
        for await (const leaf of leafCursor)
            for (const content of leaf.termContents)
                makeContentPermanent(content)

        console.log('Deleting dangling video files...');
        let videoCursor = videoRepo.getFromCursor(from)
        for await (const video of videoCursor)
            if (await leafRepo.videoIdExistsFrom(video._id.toString(), from) !== true)
                deleteVideo(video._id.toString())

        const audioCursor = audioFileRepo.getFromCursor(from)
        for await (const audio of audioCursor)
            if (await leafRepo.audioIdExistsFrom(audio._id.toString(), from) !== true)
                deleteAudio(audio._id.toString())

        const imageCursor = imageRepo.getFromCursor(from)
        for await (const image of imageCursor)
            if (await leafRepo.imageIdExistsFrom(image._id.toString(), from) !== true)
                deleteImage(image._id.toString())

        console.log('Deleting dangling thumbnails...');
        const thumbnailCursor = thumbnailRepo.getFromCursor(from)
        videoCursor = videoRepo.getFromCursor(from)
        for await (const thumbnail of thumbnailCursor)
            if (!(await videoRepo.get(thumbnail?.metadata?.videoId)))
                deleteThumbnail(thumbnail._id.toString())

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