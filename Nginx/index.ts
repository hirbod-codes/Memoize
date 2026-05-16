import express from 'express';
import https from 'https'
import fs from 'fs'
import dotenv from 'dotenv';
import { audioRoutes } from './routes/audioFile';
import { getBooleanEnv, getIntegerEnv, getStringEnv, tryAndWait } from './utils';
import { MongoDB } from './DB/mongodb';
import { UserRepository } from './DB/repositories/UserRepository';
import { AudioFileRepository } from './DB/repositories/AudioFileRepository';
import { CoverArtRepository } from './DB/repositories/CoverArtRepository';
import AudioRepository from './DB/repositories/AudioRepository';
import { artistRoutes } from './routes/artist';
import { AvatarRepository } from './DB/repositories/AvatarRepository';
import AlbumRepository from './DB/repositories/AlbumRepository';
import ArtistRepository from './DB/repositories/ArtistRepository';
import { albumRoutes } from './routes/album';
import { jsonResponseLogger, streamResponseLogger } from './middlewares/responseLogger';
import { generalRateLimiter } from './middlewares/rateLimiting';
import { authRoutes } from './routes/auth';
import { InvalidTokensRepository } from './DB/repositories/InvalidTokensRepository';
import { userRoutes } from './routes/user';

dotenv.config({ debug: process.env.DEBUG !== undefined ? Boolean(process.env.DEBUG) : undefined })

export const isProduction = getStringEnv('NODE_ENV', 'The Node env environment variable is not provided')! === 'production'

export const hostName = getStringEnv('HOST', 'The HOST environment variable is not provided')
export const hostPort = getIntegerEnv('PORT', 'The PORT environment variable is not provided', (s) => s.min(1025))


export const accessTokenSecret = getStringEnv('ACCESS_TOKEN_SECRET', 'The access token secret environment variable is not provided')
export const refreshTokenSecret = getStringEnv('REFRESH_TOKEN_SECRET', 'The refresh token secret environment variable is not provided')
export const allowedOrigins = getStringEnv('ALLOWED_ORIGINS', 'The Allowed origins environment variable is not provided')!

export const dbConfig = {
    databaseName: getStringEnv('DB_DATABASE_NAME', 'The Db database name environment variable is not provided'),
    supportsTransaction: getBooleanEnv('DB_SUPPORTS_TRANSACTION', 'The Db supports transaction environment variable is not provided'),
    url: getStringEnv('DB_URL', 'The Db url environment variable is not provided'),
    auth: {
        username: getStringEnv('MONGODB_USERNAME', 'The Mongodb username environment variable is not provided'),
        password: getStringEnv('MONGODB_PASSWORD', 'The Mongodb password environment variable is not provided'),
    }
};

(async () => {
    if (!await tryAndWait(async () => {
        MongoDB.config = dbConfig

        const db = MongoDB.getDbInstance()

        await db.reset();

        db.addRepository(new UserRepository())
        db.addRepository(new InvalidTokensRepository())
        db.addRepository(new AudioRepository())
        db.addRepository(new ArtistRepository())
        db.addRepository(new AlbumRepository())
        db.addRepository(new AudioFileRepository())
        db.addRepository(new CoverArtRepository())
        db.addRepository(new AvatarRepository())

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
    app.use('/api/artist', artistRoutes);
    app.use('/api/album', albumRoutes);
    app.use('/api/audio', audioRoutes);
    app.use('/api/user', userRoutes);

    // 404 For unknown URLs
    app.use((_req, res) => { res.sendStatus(404) })

    app.listen(hostPort, hostName, () => console.log(`listening on ${hostName}:${hostPort}...`))
})()
