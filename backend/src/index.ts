// Must be imported before models
import { addYupMethods } from './DB/common_schemas';
addYupMethods();

import express from 'express';
import https from 'https';
import fs from 'fs';

import { dbConfig, isProduction, allowedOrigins, hostPort, hostName, meilisearchPort, meilisearchHost, meilisearchKey, s3Endpoint, s3AccessKey, s3SecretKey } from './configs';

import { metricsMiddleware } from './observability/metrics';
import { metricsRouter } from './observability/metricsRoute';
import { healthRouter } from './observability/health';
import { httpLogger } from './observability/httpLogger';
import { errorLoggingMiddleware, registerProcessErrorHandlers } from './observability/errorHandling';
import { logger } from './observability/logger';

import { tryAndWait } from './utils';

import { Meilisearch } from 'meilisearch'
import { setupSearch } from './DB/meilisearch';

import { MongoDB } from './DB/mongodb';
import { UserRepository } from './DB/repositories/UserRepository';
import { InvalidTokensRepository } from './DB/repositories/InvalidTokensRepository';
import LeafRepository from './DB/repositories/LeafRepository';
import TreeNodeRepository from './DB/repositories/TreeNodeRepository';
import VideoRepository from './DB/repositories/VideoRepository';
import AudioRepository from './DB/repositories/AudioRepository';
import ImageRepository from './DB/repositories/ImageRepository';

import { runCronjobs } from './cronjobs';
import { jsonResponseLogger, streamResponseLogger } from './middlewares/responseLogger';
import { generalRateLimiter } from './middlewares/rateLimiting';

// Must be before route imports
import { platform } from "os";
import path from 'path';
import ffmpeg from "fluent-ffmpeg";

const platformName = platform();

const ffmpegBinaryPath = platformName === "win32" ? path.join(process.cwd(), "src", "ffmpeg-8.1-essentials_build", "bin", "ffmpeg.exe") : path.join(process.cwd(), "src", "ffmpeg-7.0.2-amd64-static", "ffmpeg");
ffmpeg.setFfmpegPath(ffmpegBinaryPath);

const ffprobeBinaryPath = platformName === "win32" ? path.join(process.cwd(), "src", "ffmpeg-8.1-essentials_build", "bin", "ffprobe.exe") : path.join(process.cwd(), "src", "ffmpeg-7.0.2-amd64-static", "ffprobe");
ffmpeg.setFfprobePath(ffprobeBinaryPath);

export { ffmpeg };

import { leafRoutes } from './routes/leaf';
import { treeNodeRoutes } from './routes/treeNode';
import { audioRoutes } from './routes/audio';
import { imageRoutes } from './routes/image';
import { videoRoutes } from './routes/video';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/user';
import { ttsRoutes } from './routes/tts';

import { S3Client } from "@aws-sdk/client-s3";

import { isAdmin } from './middlewares/auth';
import { startMetricsPush } from './observability/pushgateway';
import { setRequestLogger } from './observability/requestContext';

export const meili = new Meilisearch({
    host: meilisearchHost + ':' + meilisearchPort.toString(),
    apiKey: meilisearchKey
});

export const s3 = new S3Client({
    region: 'us-east-1',
    followRegionRedirects: true,
    endpoint: s3Endpoint,
    credentials: {
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey
    },
    forcePathStyle: true // often required for S3-compatible services
});

(async () => {
    await setupSearch();

    if (!await tryAndWait(async () => {
        MongoDB.config = dbConfig

        const db = MongoDB.getDbInstance()

        await db.reset();

        db.addRepository(new UserRepository())
        db.addRepository(new InvalidTokensRepository())
        db.addRepository(new AudioRepository())
        db.addRepository(new ImageRepository())
        db.addRepository(new VideoRepository())
        db.addRepository(new LeafRepository())
        db.addRepository(new TreeNodeRepository())

        // if (!isProduction)
        //     await MongoDB.getDbInstance().dropSeedableCollections()

        await db.createCollections()

        // if (!isProduction)
        //     await db.seedCollections()
    }))
        throw new Error('Failed to prepare database.')

    registerProcessErrorHandlers();

    const app = express()

    // --- Observability middleware first, so it wraps everything downstream ---
    app.use(metricsMiddleware());
    app.use(httpLogger);

    app.use((req, res, next) => {
        setRequestLogger(req.log);
        next();
    });

    // --- Unauthenticated, network-restricted endpoints ---
    app.use(healthRouter); // /healthz, /readyz
    app.use(metricsRouter); // /metrics — scraped by Prometheus, not by users

    if (isProduction)
        app.set("trust proxy", 1);

    app.use(generalRateLimiter);

    app.use(isAdmin, (req, res, next) => {
        const logLevelQueryParam = req.query.logLevel

        if (logLevelQueryParam !== 'debug')
            return next()

        req.log.info({ logLevelQueryParam }, 'Switching effective log level to DEBUG')
        req.log = req.log.child({}, { level: 'debug' })

        setRequestLogger(req.log)

        next()
    })

    app.use(express.json())

    app.disable('x-powered-by')

    // CORS
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', allowedOrigins)
        res.header('Access-Control-Allow-Credentials', 'true')
        res.header('Access-Control-Allow-Method', 'GET,POST,PUT,DELETE,OPTIONS')
        res.header('Access-Control-Allow-Headers', '*,authorization,Authorization,Content-Type')

        if (req.method === 'OPTIONS')
            res.sendStatus(204)
        else
            next()
    });

    // // To simulate slow connections
    // if (isProduction !== true)
    //     app.use((req, res, next) => {
    //         setTimeout(() => {
    //             next()
    //         }, 4000 * Math.random())
    //     })

    const cookieParser = require('cookie-parser')
    app.use(cookieParser())

    app.use(jsonResponseLogger)
    app.use(streamResponseLogger)

    if (!isProduction)
        app.get('/is_seeding', (req, res) => { res.status(200).json({ isSeeding: MongoDB.isSeeding() }) })

    if (!isProduction)
        app.get('/', (req, res) => {
            res.send('test route' + (new Date()).toISOString());
        });

    app.use('/api/auth', authRoutes);
    app.use('/api/user', userRoutes);
    app.use('/api/leaf', leafRoutes);
    app.use('/api/treeNode', treeNodeRoutes);
    app.use('/api/image', imageRoutes);
    app.use('/api/audio', audioRoutes);
    app.use('/api/video', videoRoutes);
    app.use('/api/tts', ttsRoutes);

    // 404 For unknown URLs
    app.use((_req, res) => { res.sendStatus(404) })

    app.use(errorLoggingMiddleware());

    if (!isProduction)
        https.createServer({
            key: fs.readFileSync('localhost+2-key.pem'),
            cert: fs.readFileSync('localhost+2.pem')
        }, app)
            .listen(hostPort, hostName, () => logger.info({ hostName, hostPort }, `listening on ${hostName}:${hostPort}...`))
    else
        // Server is behind NginX proxy
        app.listen(hostPort, hostName, () => logger.info({ hostName, hostPort }, `listening on ${hostName}:${hostPort}...`))

    startMetricsPush();

    runCronjobs()
})()
