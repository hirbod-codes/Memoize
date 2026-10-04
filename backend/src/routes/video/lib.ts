import { Request, Response } from "express";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import VideoRepository from "../../DB/repositories/VideoRepository";
import { getLogger } from "../../observability/requestLoggerContext";
import { s3 } from "../..";
import { BUCKET_NAME } from "../../configs";

export async function streamVideoFile(videoId: string, userId: string, req: Request, res: Response, isWeb: boolean) {
    const log = getLogger().child({ step: 'streamVideoFile' });
    let body: Readable | undefined;
    let key: string | undefined;

    try {
        const video = await new VideoRepository().getForUser(videoId, userId);
        if (!video || (isWeb && !video.webBucketKey) || (!isWeb && !video.bucketKey)) {
            return res.status(404).json({ status: 'error', message: 'Video not found' });
        }

        const range = req.headers.range;
        key = (isWeb ? video.webBucketKey : video.bucketKey)!;
        log.info({ key, range }, 'Fetching object from storage');

        const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key, Range: range }));
        log.info({ contentLength: result.ContentLength, contentRange: result.ContentRange }, 'Fetched object from storage');

        if (!result.Body) return res.status(404).json({ status: 'error', message: 'Video not found' });
        body = result.Body as Readable;

        res.status(result.ContentRange ? 206 : 200);
        res.setHeader('Content-Type', isWeb ? 'video/mp4' : (video.contentType?.mimeType ?? 'video/mp4'));
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        if (result.ContentRange) res.setHeader('Content-Range', result.ContentRange);
        if (result.ContentLength != null) res.setHeader('Content-Length', String(result.ContentLength));

        res.on('close', () => body?.destroy());

        log.info({ statusCode: res.statusCode }, 'Streaming video file to client');
        await pipeline(body, res);
        log.info('Finished streaming');
    } catch (err: any) {
        if (err?.code === 'ERR_STREAM_PREMATURE_CLOSE') throw err;
        if (err?.name === 'NoSuchKey') {
            if (!res.headersSent) res.status(404).json({ status: 'error', message: 'Video not found' });
            return;
        }
        if (err?.name === 'InvalidRange' || err?.$metadata?.httpStatusCode === 416) {
            if (!res.headersSent) res.status(416).end();
            return;
        }
        log.error({ err, key }, 'Failed to serve video file');
        if (!res.headersSent) res.status(500).json({ status: 'error', message: 'Streaming failed' });
        else res.destroy();
    }
}