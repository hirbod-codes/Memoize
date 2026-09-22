import express from 'express';
import { auth } from '../../middlewares/auth';
import { BUCKET_NAME, imageUploadTmpDir } from '../../configs';
import ImageRepository from '../../DB/repositories/ImageRepository';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../..';
import { authorizeAllowedContentTypes, authorizeStorageQuota, rollbackStorageQuota } from '../../middlewares/authorization';
import { join } from 'path';
import { mkdir, rm, unlink } from 'fs/promises';
import { deleteFromS3, detectContentType, receiveUpload, uploadToS3 } from '../../lib/file_management';
import { Usage } from '../../DB/models/Usage';
import { UploadTooLargeError } from '../../errors/UploadTooLargeError';
import { createReadStream } from 'fs';
import { InvalidMediaError } from '../../errors/InvalidMediaError';
import { Readable } from 'stream';
import { getLogger, runWithLogger } from '../../observability/requestLoggerContext';
import { handleError, validate } from '../../lib';
import {
    postImageSchema,
    listQuerySchema,
    infoQuerySchema,
    fileParamsSchema,
    deleteParamsSchema,
} from './schemas';
import UsageRepository from '../../DB/repositories/UsageRepository';

const router = express.Router();

router.post('/', auth, async (req, res) => {
    let log = getLogger().child({ module: 'image', route: 'POST /api/image/' });

    try {
        log.info('Image upload request received');

        if (authorizeAllowedContentTypes(req, 'image', res) !== true) {
            log.info('authorization of allowed content types has failed')
            return
        }

        log.debug({ query: req.query });
        const { fileName, title } = await runWithLogger(log, () => validate(postImageSchema, req.query));
        log.info('Input validated');
        log.debug({ fileName, title });

        const userId = req.user!.userId;
        log = log.child({ userId });

        const imageRepository = new ImageRepository();
        const usageRepository = new UsageRepository();

        // ------------------------------------------------------------------------- Checking weather title already exists...
        const image = await runWithLogger(log, () => imageRepository.getForUserByTitle(title, userId));
        log.debug({ image });
        log.info('Checked title uniqueness');
        if (image) {
            log.info('Rejected image upload: title already exists');
            return res.status(400).json({ status: 'error', message: 'Image title must be unique.' });
        }

        // ------------------------------------------------------------------------- Inserting image...
        const imageInsertResult = await runWithLogger(log, () => imageRepository.insert({ title, userId, temporary: true }));
        log.debug({ imageInsertResult });
        if (!imageInsertResult.acknowledged || !imageInsertResult.insertedId) {
            log.error({ imageInsertResult }, 'temporary image info creation failed');
            return res.status(500).json({ status: 'error', message: 'Image info creation failed' });
        }
        log.info('Inserted temporary image info record');

        const imageId = imageInsertResult.insertedId.toString();
        log.debug({ imageId });
        log = log.child({ imageId });

        // ------------------------------------------------------------------------- Make the temporary directory
        const jobDir = join(imageUploadTmpDir, imageId);
        await mkdir(jobDir, { recursive: true });
        log.debug({ jobDir });
        log.info('Created job scratch directory');

        const cleanupPaths: string[] = [];
        const cleanup = async () => {
            log.debug({ cleanupPaths, jobDir });
            log.info('Cleaning up temp files');
            await Promise.all(cleanupPaths.map((p) => unlink(p).catch(() => { })));
            await rm(jobDir, { recursive: true, force: true }).catch(() => { });
        };

        let rollbackPromises: undefined | Promise<any> = undefined;
        try {
            // ------------------------------------------------------------------------- fetch available storage bytes for user from user subscription and usage
            log.info('fetch available storage bytes for user from user subscription and usage')
            const maxTotalStorageBytes = req.user!.privileges!.storageBytes;
            log.debug({ maxTotalStorageBytes }, 'Resolved plan storage limit');

            const usage: Usage | undefined = await runWithLogger(log, () => usageRepository.getByUserId(userId))
            log.debug({ usage })
            if (!usage) {
                log.error("failed to find authenticated user's usage data")
                return res.status(500).json({ status: 'error', error_code: 'INTERNAL_ERROR' })
            }
            const allowedStorageBytes = maxTotalStorageBytes - usage.storageBytesCount
            log.debug({ availableStorageBytes: allowedStorageBytes })

            // ------------------------------------------------------------------------- store upload stream on disk
            log.info('store upload stream on disk')
            const { path: inputPath, size: inputSize } = await runWithLogger(log, () => receiveUpload(req, allowedStorageBytes, jobDir));
            cleanupPaths.push(inputPath);
            log.debug({ inputSize, inputPath });
            log.info('Upload received and stored to disk');

            // ------------------------------------------------------------------------- set bucket keys
            log.info('set bucket keys')
            const imageFileBucketKey = `image/${userId}/${imageId}`;
            log.debug({ imageFileBucketKey });
            log.info('Computed bucket keys');

            // ------------------------------------------------------------------------- detect content type
            log.info('detect content type')
            const contentType = await runWithLogger(log, () => detectContentType(inputPath));
            log.debug({ contentType });
            log.info('Detected content type');

            // ------------------------------------------------------------------------- authorize generated file sizes
            log.info('authorize generated file sizes')

            const totalStorageBytes = inputSize;
            log.debug({ inputSize, totalStorageBytes }, 'Computed total storage footprint');

            if ((await authorizeStorageQuota(req, totalStorageBytes, undefined, res)) !== true) {
                log.info({ totalStorageBytes }, 'Rejected video upload: exceeds plan storage limit')
                throw new UploadTooLargeError('Generated files exceed plan storage limit')
            }
            log.info('Storage quota authorized')

            try {
                // ------------------------------------------------------------------------- Upload files to the S3 compatible object storage
                log.info('Uploading files to object storage');
                await runWithLogger(log, () => uploadToS3(createReadStream(inputPath), imageFileBucketKey, contentType.mimeType));
                log.debug({ imageFileBucketKey, totalStorageBytes });
                log.info('Uploaded files to object storage');

                // ------------------------------------------------------------------------- Update image info in DB, Make it permanent and set content type
                const updateResult = await runWithLogger(log, () => imageRepository.unsafeUpdate(imageId, userId, { contentType: contentType, temporary: false, bucketKey: imageFileBucketKey }));
                log.debug({ updateResult });
                if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
                    log.info('updating image record failed');
                    throw new Error('failed to upload image');
                }
                log.info('Updated image record');
                log.info({ totalStorageBytes }, 'Image upload finalized');
            } catch (error) {
                log.error({ err: error }, 'Post-upload finalization failed, rolling back stored artifacts');
                rollbackPromises = Promise.allSettled([
                    runWithLogger(log, () => deleteFromS3(imageFileBucketKey).catch((_) => { })),
                    runWithLogger(log, () => imageRepository.delete(imageId).catch((_) => { })),
                    runWithLogger(log, () => rollbackStorageQuota(req, totalStorageBytes)).catch((err) => { log.error({ err, userId, totalStorageBytes }, 'failed to decrement user usage') }),
                ]);

                throw error;
            }
        } catch (err) {
            if (err instanceof UploadTooLargeError) {
                res.status(402).json({ status: 'error', error: err.message });
            } else if (err instanceof InvalidMediaError) {
                res.status(400).json({ status: 'error', error: err.message });
            } else {
                log.error({ err }, 'Image upload failed');
                res.status(500).json({ status: 'error', error: 'Upload failed' });
            }
        } finally {
            await cleanup();
            if (rollbackPromises !== undefined) {
                await rollbackPromises;
                log.info('Rollback of stored artifacts completed');
            }
        }

        res.status(201).json({ status: 'success', data: imageId });
    } catch (err) {
        runWithLogger(log, () => handleError(res, err));
    }
});

router.get('/', auth, async (req, res) => {
    let log = getLogger().child({ module: 'image', route: 'GET /api/image/' });

    try {
        log.info('Image list request received');

        log.debug({ query: req.query });
        const { page, pageSize } = await runWithLogger(log, () => validate(listQuerySchema, req.query));
        log.info('Input validated');
        log.debug({ page, pageSize });

        const userId = req.user!.userId;
        log = log.child({ userId, page, pageSize });

        const imageRepository = new ImageRepository();

        const skip = (page - 1) * pageSize;
        const [items, total] = await runWithLogger(log, () => Promise.all([
            imageRepository.getPageForUser(userId, skip, pageSize),
            imageRepository.countForUser(userId),
        ]));
        log.debug({ count: items.length, total });
        log.info('Fetched image page');

        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        log.info({ totalPages }, 'Listed images');

        res.status(200).json({ status: 'success', data: { items, page, pageSize, total, totalPages, hasMore: page < totalPages } });
    } catch (err) {
        runWithLogger(log, () => handleError(res, err));
    }
});

router.get('/info/', auth, async (req, res) => {
    let log = getLogger().child({ module: 'image', route: 'GET /api/image/info/' });

    try {
        log.info('Image info request received');

        log.debug({ query: req.query });
        const { imageId, title } = await runWithLogger(log, () => validate(infoQuerySchema, req.query));
        log.info('Input validated');
        log.debug({ imageId, title });

        const userId = req.user!.userId;
        log = log.child({ userId, imageId, title });

        const imageRepository = new ImageRepository();

        const result = imageId
            ? await runWithLogger(log, () => imageRepository.getForUser(imageId, userId))
            : await runWithLogger(log, () => imageRepository.getForUserByTitle(title!, userId));
        log.debug({ result });
        log.info('Looked up image info');

        if (!result) {
            log.info('Image not found');
            return res.status(404).json({ status: 'error', message: 'Image not found' });
        }

        res.status(200).json({ status: 'success', data: result });
    } catch (err) {
        runWithLogger(log, () => handleError(res, err));
    }
});

router.get('/file/:imageId', auth, async (req, res) => {
    let log = getLogger().child({ module: 'image', route: 'GET /api/image/file/:imageId' });

    try {
        log.info('Image file request received');

        log.debug({ params: req.params, query: req.query });
        const { imageId, download } = await runWithLogger(log, () => validate(fileParamsSchema, { ...req.params, ...req.query }));
        log.info('Input validated');
        log.debug({ imageId, download });

        const userId = req.user!.userId;
        log = log.child({ userId, imageId, download });

        const imageRepository = new ImageRepository();

        const image = await runWithLogger(log, () => imageRepository.getForUser(imageId, userId));
        log.debug({ image });
        log.info('Checked image ownership');
        if (!image || !image.bucketKey || !image.contentType) {
            log.info('Rejected image file request: image not found or missing expected bucket key');
            return res.status(404).json({ status: 'error', message: 'Image not found' });
        }

        const result = await runWithLogger(log, () => s3.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: image.bucketKey,
            ResponseContentDisposition: download ? `attachment; filename="${image._id!.toString()}.${image.contentType!.extension}"` : undefined,
        })));
        log.debug({ key: image.bucketKey, contentLength: result.ContentLength, contentRange: result.ContentRange });
        log.info('Fetched object from storage');

        if (result.Body === undefined || result.Body === null) {
            log.warn({ key: image.bucketKey }, 'Storage object has no body');
            return res.status(404).json({ status: 'error', message: 'Image not found' });
        }

        const body = result.Body as Readable;
        body.on('error', (err) => {
            log.error({ err, key: image.bucketKey }, 'S3 stream error while serving image file');
            if (!res.headersSent) return runWithLogger(log, () => handleError(res, err));
            res.destroy();
        });

        res.status(200);
        res.setHeader('Content-Type', image.contentType.mimeType);
        if (result.ContentRange) res.setHeader('Content-Range', result.ContentRange);
        if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength);

        log.info('Streaming image file to client');
        body.pipe(res);
    } catch (err) {
        runWithLogger(log, () => handleError(res, err));
    }
});

router.delete('/:imageId', auth, async (req, res) => {
    let log = getLogger().child({ module: 'image', route: 'DELETE /api/image/:imageId' });

    try {
        log.info('Image delete request received');

        log.debug({ params: req.params });
        const { imageId } = await runWithLogger(log, () => validate(deleteParamsSchema, req.params));
        log.info('Input validated');
        log.debug({ imageId });

        const userId = req.user!.userId;
        log = log.child({ userId, imageId });

        const imageRepository = new ImageRepository();

        const image = await runWithLogger(log, () => imageRepository.getForUser(imageId, userId));
        log.debug({ image, bucketKey: image?.bucketKey });
        log.info('Checked image ownership');
        if (!image) {
            log.info('Rejected image delete request: image not found');
            return res.status(404).json({ status: 'error', message: 'Image not found' });
        }

        const r = await runWithLogger(log, () => imageRepository.unsafeUpdate(imageId, userId, { temporary: true }));
        log.debug({ updateResult: r });
        if (!r.acknowledged || r.matchedCount) {
            log.error({ updateResult: r }, 'Failed to mark image temporary before delete');
            return res.status(500).json({ status: 'error', message: 'Error deleting image' });
        }
        log.info('Marked image temporary in DB before delete');

        await runWithLogger(log, () => s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: image.bucketKey })));
        log.debug({ key: image.bucketKey });
        log.info('Deleted image file from storage');

        const rr = await runWithLogger(log, () => imageRepository.delete(imageId));
        log.debug({ deleteResult: rr });
        if (!rr.acknowledged) {
            log.error({ deleteResult: rr }, 'Failed to delete image record from DB');
            return res.status(500).json({ status: 'error', message: 'Error deleting image' });
        }
        log.info('Image deleted');

        res.status(204).json({ status: 'success' });
    } catch (err) {
        runWithLogger(log, () => handleError(res, err));
    }
});

export { router as imageRoutes };