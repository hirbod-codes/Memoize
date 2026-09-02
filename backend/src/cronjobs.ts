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
import { payments, s3 } from '.'
import SubscriptionRepository from './DB/repositories/SubscriptionRepository'
import { getLogger, runWithLogger } from './observability/requestLoggerContext'
import { Subscription } from './DB/models/Subscription'

export const runCronjobs = async () => {
    const cronLog = getLogger()

    cronLog.info('scheduling jobs...')

    // Schedule: every 12 hours
    // "0 0 */12 * * *" => second, minute, hour, day, month, weekday
    cron.schedule('0 0 */12 * * *', async () => {
        const log = getLogger().child({ module: 'cronjob', job: 'clean temporary contents' });

        log.info('Sending delete requests for temporary contents...');

        const from = Date.now() - (14 * 60 * 60)

        const userRepo = new UserRepository()

        const videoRepo = new VideoRepository()
        const imageRepo = new ImageRepository()
        const audioRepo = new AudioRepository()

        const deleteVideo = (videoId: string) => {
            log.info(`Deleting video id: ${videoId} ...`);

            videoRepo.delete(videoId)
                .then(videoRepoDeleteResult => log.info({ videoRepoDeleteResult }))
                .catch(e => log.error({ error: e }))
        }

        const deleteAudio = async (audioId: string) => {
            log.info(`Deleting audio id: ${audioId} ...`);

            audioRepo.delete(audioId)
                .then(audioRepoDeleteResult => log.info({ audioRepoDeleteResult }))
                .catch(e => log.error({ error: e }))
        }

        const deleteImage = async (imageId: string) => {
            log.info(`Deleting image id: ${imageId} ...`);

            imageRepo.delete(imageId)
                .then(imageRepoDeleteResult => log.info({ imageRepoDeleteResult }))
                .catch(e => log.error({ error: e }))
        }

        const deleteAvatar = async (userId: string) => {
            log.info(`Deleting avatar of user id: ${userId} ...`);

            userRepo.unsafeUpdate(userId, { avatarKey: undefined, temporaryAvatar: false })
                .then(userRepoDeleteAvatarResult => log.info({ userRepoDeleteAvatarResult }))
                .catch(e => log.error({ error: e }))
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
                log.error({ error: e }, `failure while trying to delete video file with key: ${key}`)
            }
        }

        log.info('Deleting dangling avatar files...');
        const handleAvatarRemove = async (user: User) => {
            if (user.avatarKey)
                await deleteObjectIfExists(user.avatarKey)
            deleteAvatar(user._id!.toString())
        }
        let userCursor = userRepo.getTemporaryAvatarFromCursor(from)
        for await (const user of userCursor)
            handleAvatarRemove(user)

        log.info('Deleting dangling video files...');
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

        log.info('Deleting dangling audio files...');
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

        log.info('Deleting dangling image files...');
        const handleImageRemove = async (image: Image) => {
            if (image.bucketKey)
                await deleteObjectIfExists(image.bucketKey)
            deleteImage(image._id!.toString())
        }
        let imageCursor = imageRepo.getTemporariesFromCursor(from)
        for await (const image of imageCursor)
            handleImageRemove(image)

        log.info('done');
    })

    // Schedule: every 4 hours
    // "0 0 */4 * * *" => second, minute, hour, day, month, weekday
    cron.schedule('0 0 */4 * * *', async () => {
        const log = getLogger().child({ module: 'cronjob', job: 'clean dangling subscriptions' });

        try {

            log.info('deleting dangling subscriptions...');

            const subscriptionRepository = new SubscriptionRepository()

            log.info('cancelling subscriptions with status \'paymentNotCompleted\'...');
            const subscriptionUpdateResult = await subscriptionRepository.cancelByStatus(['paymentNotCompleted'], 4)
            log.info({ subscriptionUpdateResult })
            if (!subscriptionUpdateResult.acknowledged) {
                log.error({ subscriptionUpdateResult }, 'job failed to clean dangling subscriptions')
                return
            }

            const cancel = async (subscription: Subscription) => {
                log.info('updating subscription status to \'canceled\'')
                let updateResult = await runWithLogger(log, () => subscriptionRepository.unsafeUpdate(subscription._id!.toString(), subscription.userId, { status: 'canceled' }))
                log.debug({ updateResult })
                if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
                    log.info('failed to cancel user\'s subscription')
                    // cronjob will clean up the subscription
                }
            }

            const markAsInDebt = async (subscription: Subscription) => {
                log.info('updating subscription status to \'inDebtToUser\'')
                let updateResult = await runWithLogger(log, () => subscriptionRepository.unsafeUpdate(subscription._id!.toString(), subscription.userId, { status: 'inDebtToUser' }))
                log.debug({ updateResult })
                if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
                    log.info('failed to cancel user\'s subscription')
                    // cronjob will clean up the subscription
                }
            }

            const handleSubscription = async (subscription: Subscription): Promise<boolean> => {
                const { price: { amount }, paymentMethod, paymentAuthority: authority, userId } = subscription
                const payment: IPay = payments[paymentMethod]!

                log.info('verifying payment...')
                const result = await runWithLogger(log, () => payment.verify({ authority, amount }))
                log.debug({ result })
                if (result == false) {
                    log.info('this subscription is already rolled back automatically by the third party payment provider, cancelling this dangling subscription')
                    await cancel(subscription)
                    return false
                }
                const { refId, cardNumber, cardNumberHash } = result

                log.info('remove user\'s valid subscriptions')
                const deleteResult = await runWithLogger(log, () => subscriptionRepository.deleteByStatusForUser(userId, ['active', 'trialing']))
                if (!deleteResult.acknowledged) {
                    log.info('job failed to delete active subscriptions of user, since the transaction is not reverseable anymore, the subscription is marked as in debt')
                    await markAsInDebt(subscription)

                    return false
                }

                log.info('updating subscription status to \'active\'')
                const updateResult = await runWithLogger(log, () => subscriptionRepository.unsafeUpdate(subscription._id!.toString(), userId, { status: 'active', verifiedAt: Date.now(), refId, cardNumber, cardNumberHash }))
                log.debug({ updateResult })
                if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
                    log.info('job failed to activate user\' subscription, since the transaction is not reverseable anymore, the subscription is marked as in debt')
                    log.info('failed to activate user\'s subscription')
                    // rollback payment
                    await markAsInDebt(subscription)

                    return false
                }

                return true
            }

            const promises: Promise<boolean>[] = []

            const subscriptions = await subscriptionRepository.getByStatus(['paymentNotVerified'])
            for (const subscription of subscriptions) {
                log.info({ subscription }, 'handling subscription')
                promises.push(handleSubscription(subscription))
            }

            const results = await Promise.allSettled<boolean>(promises)
            log.info({ fulfilledCount: results.map(m => m.status === 'fulfilled' ? m.value === true : false).filter((f) => f === true).length, rejectedCount: results.filter((f) => f.status === 'rejected').length }, 'handled all the subscriptions')

            log.info('done');
        } catch (error) {
            log.error({ error }, 'job threw error, while trying to clean dangling subscriptions')
        }
    })

    cronLog.info('Cron jobs scheduled')
}