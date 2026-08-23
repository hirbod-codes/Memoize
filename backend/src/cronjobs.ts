import cron from 'node-cron'
import VideoRepository from './DB/repositories/VideoRepository'
import { BUCKET_NAME } from './configs'
import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { Video } from './DB/models/Video'
import { Audio } from './DB/models/Audio'
import AudioRepository from './DB/repositories/AudioRepository'
import ImageRepository from './DB/repositories/ImageRepository'
import { Image } from './DB/models/Image'
import { User } from './DB/models/User'
import { UserRepository } from './DB/repositories/UserRepository'
import { s3 } from '.'

export const runCronjobs = async () => {
    // Schedule: every 12 hours
    // "0 0 */12 * * *" => second, minute, hour, day, month, weekday
    cron.schedule('0 0 */12 * * *', async () => {
        console.log('Sending delete requests for temporary contents...');

        const from = Date.now() - (14 * 60 * 60)

        const userRepo = new UserRepository()

        const videoRepo = new VideoRepository()
        const imageRepo = new ImageRepository()
        const audioRepo = new AudioRepository()

        const deleteVideo = (videoId: string) => {
            console.log(`Deleting video id: ${videoId} ...`);

            videoRepo.delete(videoId)
                .then(videoRepoDeleteResult => console.log({ videoRepoDeleteResult }))
                .catch(e => console.error(e))
        }

        const deleteAudio = async (audioId: string) => {
            console.log(`Deleting audio id: ${audioId} ...`);

            audioRepo.delete(audioId)
                .then(audioRepoDeleteResult => console.log({ audioRepoDeleteResult }))
                .catch(e => console.error(e))
        }

        const deleteImage = async (imageId: string) => {
            console.log(`Deleting image id: ${imageId} ...`);

            imageRepo.delete(imageId)
                .then(imageRepoDeleteResult => console.log({ imageRepoDeleteResult }))
                .catch(e => console.error(e))
        }

        const deleteAvatar = async (userId: string) => {
            console.log(`Deleting avatar of user id: ${userId} ...`);

            userRepo.unsafeUpdate(userId, { avatarKey: undefined, temporaryAvatar: false })
                .then(userRepoDeleteAvatarResult => console.log({ userRepoDeleteAvatarResult }))
                .catch(e => console.error(e))
        }

        const objectExistsInS3 = async (key: string): Promise<boolean> => {
            try {
                await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }))

                return true
            } catch (e: any) {
                if (e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404) return false

                throw e
            }
        }

        const deleteObjectInS3 = async (key: string): Promise<boolean> => {
            try {
                await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))

                return true
            } catch (e: any) {
                if (e?.name === 'NotFound' || e?.$metadata.httpStatusCode === 404) return false

                throw e
            }
        }

        const deleteObjectIfExists = async (key: string) => {
            try {
                if (!await objectExistsInS3(key)) return true

                await deleteObjectInS3(key)
            } catch (e) {
                console.error(`failure while trying to delete video file with key: ${key}`)
                console.error(e)
            }
        }

        console.log('Deleting dangling avatar files...');
        const handleAvatarRemove = async (user: User) => {
            if (user.avatarKey)
                await deleteObjectIfExists(user.avatarKey)
            deleteAvatar(user._id!.toString())
        }
        let userCursor = userRepo.getTemporaryAvatarFromCursor(from)
        for await (const user of userCursor)
            handleAvatarRemove(user)

        console.log('Deleting dangling video files...');
        const handleVideoRemove = async (video: Video) => {
            if (video.bucketKey)
                await deleteObjectIfExists(video.bucketKey)
            if (video.thumbnailKey)
                await deleteObjectIfExists(video.thumbnailKey)
            deleteVideo(video._id!.toString())
        }
        let videoCursor = videoRepo.getTemporariesFromCursor(from)
        for await (const video of videoCursor)
            handleVideoRemove(video)

        console.log('Deleting dangling audio files...');
        const handleAudioRemove = async (audio: Audio) => {
            if (audio.bucketKey)
                await deleteObjectIfExists(audio.bucketKey)
            if (audio.coverArtKey)
                await deleteObjectIfExists(audio.coverArtKey)
            deleteAudio(audio._id!.toString())
        }
        let audioCursor = audioRepo.getTemporariesFromCursor(from)
        for await (const audio of audioCursor)
            handleAudioRemove(audio)

        console.log('Deleting dangling image files...');
        const handleImageRemove = async (image: Image) => {
            if (image.bucketKey)
                await deleteObjectIfExists(image.bucketKey)
            deleteImage(image._id!.toString())
        }
        let imageCursor = imageRepo.getTemporariesFromCursor(from)
        for await (const image of imageCursor)
            handleImageRemove(image)

        console.log('done');
    })

    console.log('Cron jobs scheduled')
}