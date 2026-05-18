import cron from 'node-cron'
import { VideoFileRepository } from './DB/repositories/VideoFileRepository'
import { AudioFileRepository } from './DB/repositories/AudioFileRepository'
import { ImageRepository } from './DB/repositories/ImageRepository'
import VideoRepository from './DB/repositories/VideoRepository'
import { CoverArtRepository } from './DB/repositories/CoverArtRepository'
import { AvatarRepository } from './DB/repositories/AvatarRepository'
import { ThumbnailRepository } from './DB/repositories/ThumbnailRepository'

export const runCronjobs = async () => {
    // Schedule: every 12 hours
    // "0 0 */12 * * *" => second, minute, hour, day, month, weekday
    cron.schedule('0 0 */12 * * *', () => {
        console.log('Sending delete requests for temporary contents...');

        const videoFileRepo = new VideoFileRepository()
        const thumbnailRepo = new ThumbnailRepository()
        const videoRepo = new VideoRepository()
        const audioRepo = new AudioFileRepository()
        const audioFileRepo = new AudioFileRepository()
        const coverArtRepo = new CoverArtRepository()
        const imageRepo = new ImageRepository()
        const avatarRepo = new AvatarRepository()

        videoFileRepo.deleteTemporaryFiles()
            .then(videoFileRepoDeleteResult => console.log({ videoFileRepoDeleteResult }))

        thumbnailRepo.deleteTemporaryFiles()
            .then(thumbnailRepoDeleteResult => console.log({ thumbnailRepoDeleteResult }))

        videoRepo.deleteTemporaries()
            .then(videoRepoDeleteResult => console.log({ videoRepoDeleteResult }))

        audioRepo.deleteTemporaryFiles()
            .then(audioRepoDeleteResult => console.log({ audioRepoDeleteResult }))

        audioFileRepo.deleteTemporaryFiles()
            .then(audioFileRepoDeleteResult => console.log({ audioFileRepoDeleteResult }))

        coverArtRepo.deleteTemporaryFiles()
            .then(coverArtRepoDeleteResult => console.log({ coverArtRepoDeleteResult }))

        imageRepo.deleteTemporaryFiles()
            .then(imageRepoDeleteResult => console.log({ imageRepoDeleteResult }))

        avatarRepo.deleteTemporaryFiles()
            .then(avatarRepoDeleteResult => console.log({ avatarRepoDeleteResult }))

        console.log('done');
    })

    console.log('Cron jobs scheduled')
}