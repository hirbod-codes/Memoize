// Must be imported before models
import { addYupMethods } from './DB/common_schemas';
addYupMethods();

import express from 'express';
import https from 'https'
import fs from 'fs'
import dotenv from 'dotenv';

import { getBooleanEnv, getIntegerEnv, getStringEnv, tryAndWait } from './utils';

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

const ffmpegBinaryPath = platformName === "win32"
    ? path.join(process.cwd(), "src", "ffmpeg-8.1-essentials_build", "bin", "ffmpeg.exe")
    : path.join(process.cwd(), "src", "ffmpeg-7.0.2-amd64-static", "ffmpeg");
ffmpeg.setFfmpegPath(ffmpegBinaryPath);

const ffprobeBinaryPath = platformName === "win32"
    ? path.join(process.cwd(), "src", "ffmpeg-8.1-essentials_build", "bin", "ffprobe.exe")
    : path.join(process.cwd(), "src", "ffmpeg-7.0.2-amd64-static", "ffprobe");
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
dotenv.config({ debug: process.env.DEBUG !== undefined ? Boolean(process.env.DEBUG) : undefined })

export const isProduction = getStringEnv('NODE_ENV', 'The Node env environment variable is not provided')! === 'production'

export const hostName = getStringEnv('HOST', 'The HOST environment variable is not provided')
export const hostPort = getIntegerEnv('PORT', 'The PORT environment variable is not provided', (s) => s.min(1025))


export const accessTokenSecret = getStringEnv('ACCESS_TOKEN_SECRET', 'The access token secret environment variable is not provided')
export const refreshTokenSecret = getStringEnv('REFRESH_TOKEN_SECRET', 'The refresh token secret environment variable is not provided')
export const allowedOrigins = getStringEnv('ALLOWED_ORIGINS', 'The Allowed origins environment variable is not provided')!

export const meilisearchKey = getStringEnv('MEILISEARCH_KEY', 'The Meilisearch key environment variable is not provided')!
export const meilisearchHost = getStringEnv('MEILISEARCH_HOST', 'The Meilisearch host environment variable is not provided')!
export const meilisearchPort = getIntegerEnv('MEILISEARCH_PORT', 'The Meilisearch port environment variable is not provided')!

export const BUCKET_NAME = getStringEnv('BUCKET_NAME', 'The Bucket name environment variable is not provided')!
export const s3Endpoint = getStringEnv('S3_STORAGE_ENDPOINT', 'The S3 storage endpoint environment variable is not provided')!
export const s3AccessKey = getStringEnv('S3_STORAGE_ACCESS_KEY', 'The S3 storage access key environment variable is not provided')!
export const s3SecretKey = getStringEnv('S3_STORAGE_SECRET_KEY', 'The S3 storage secret key environment variable is not provided')!

export const dbConfig = {
    databaseName: getStringEnv('DB_DATABASE_NAME', 'The Db database name environment variable is not provided'),
    supportsTransaction: getBooleanEnv('DB_SUPPORTS_TRANSACTION', 'The Db supports transaction environment variable is not provided'),
    url: getStringEnv('DB_URL', 'The Db url environment variable is not provided'),
    auth: {
        username: getStringEnv('MONGODB_USERNAME', 'The Mongodb username environment variable is not provided'),
        password: getStringEnv('MONGODB_PASSWORD', 'The Mongodb password environment variable is not provided'),
    }
};

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

    const app = express()

    if (isProduction)
        app.set("trust proxy", 1);

    app.use(generalRateLimiter);

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

    if (!isProduction)
        https.createServer({
            key: fs.readFileSync('localhost+2-key.pem'),
            cert: fs.readFileSync('localhost+2.pem')
        }, app)
            .listen(hostPort, hostName, () => console.log(`listening on ${hostName}:${hostPort}...`))
    else
        // Server is behind NginX proxy
        app.listen(hostPort, hostName, () => console.log(`listening on ${hostName}:${hostPort}...`))

    runCronjobs()
})()
