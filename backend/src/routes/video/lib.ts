import { Request, Response } from "express";
import VideoRepository from "../../DB/repositories/VideoRepository";
import { getLogger } from "../../observability/requestLoggerContext";
import { s3 } from "../..";
import { BUCKET_NAME } from "../../configs";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

export async function streamVideoFile(videoId: string, userId: string, req: Request, res: Response, isWeb: boolean) {
    const log = getLogger().child({ step: 'streamVideoFile' });

    const videoRepository = new VideoRepository()

    const video = await videoRepository.getForUser(videoId, userId!)
    log.debug({ video })
    if (!video || (isWeb && !video.webBucketKey) || (!isWeb && !video.bucketKey)) {
        log.info('Video not found or missing expected bucket key');
        return res.status(404).json({ message: 'Video not found' });
    }

    const range = req.headers.range;
    const key = isWeb ? video.webBucketKey : video.bucketKey;
    log.debug({ key, range });

    log.info('Fetching object from storage')
    const result = await s3.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Range: range
    }));
    log.debug({ contentLength: result.ContentLength, contentRange: result.ContentRange });
    log.info('Fetched object from storage')

    if (result.Body === undefined || result.Body === null) {
        log.warn('Storage object has no body');
        return res.status(404).send();
    }

    const body = result.Body as Readable;
    body.on('error', (err) => {
        log.error({ err, key }, 'S3 stream error while serving video file');
        if (!res.headersSent)
            res.status(500).end();
        else
            res.destroy();
    });

    res.status(range ? 206 : 200);
    res.setHeader('Content-Type', isWeb ? 'video/mp4' : (video.contentType?.mimeType ?? 'video/mp4'));
    res.setHeader('Accept-Ranges', 'bytes');
    if (result.ContentRange) res.setHeader('Content-Range', result.ContentRange);
    if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength);

    log.info('response headers has been set')

    log.info({ statusCode: range ? 206 : 200 }, 'Streaming video file to client');
    body.pipe(res)
}
