import { ContentTypes } from "../../DB/models/Leaf";
import AudioRepository from "../../DB/repositories/AudioRepository";
import ImageRepository from "../../DB/repositories/ImageRepository";
import VideoRepository from "../../DB/repositories/VideoRepository";
import { getLogger, runWithLogger } from "../../observability/requestLoggerContext";

export async function valueExists(userId: string, type: ContentTypes, value: string): Promise<boolean> {
    let log = getLogger().child({ step: 'valueExists' });

    log.debug({ userId, type, value })

    if (type === 'string' || type === 'richText') {
        log.info('type is either string or richText')
        return true
    }

    if (type === 'imageId') {
        const imageRepository = new ImageRepository()
        const image = await runWithLogger(log, () => imageRepository.getForUser(value, userId))
        log.debug({ image })
        if (!image) {
            log.info('value not found')
            return false
        }
    }

    if (type === 'audioId') {
        const audioRepository = new AudioRepository()
        const audio = await runWithLogger(log, () => audioRepository.getForUser(value, userId))
        log.debug({ audio })
        if (!audio) {
            log.info('value not found')
            return false
        }
    }

    if (type === 'videoId') {
        const videoRepository = new VideoRepository()
        const video = await runWithLogger(log, () => videoRepository.getForUser(value, userId))
        log.debug({ video })
        if (!video) {
            log.info('value not found')
            return false
        }
    }

    log.info('found value')
    return true
}