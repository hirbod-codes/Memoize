import express from 'express';
import { Readable } from 'stream';
import { IAudioMetadata, parseBuffer } from 'music-metadata';
import { AudioFileRepository } from '../DB/repositories/AudioFileRepository';
import { CoverArtRepository } from '../DB/repositories/CoverArtRepository';
import { decodeToPCM } from '../ffmpeg';
import { analyzeAudio } from '../essentia';
import { streamToBuffer } from '../utils';
import { likeObjectId } from '../DB/common_schemas';
import { array, number, string } from 'yup';
import { auth, authorization } from '../middlewares/auth';
import { MongoDB } from '../DB/mongodb';
import { AudioMetadata, audioSchema } from '../DB/models/Files';

const router = express.Router();

router.post('/analysis', auth, async (req, res) => {
    try {
        console.log('/analyze')

        console.log('Validating...')
        let fileName: string | undefined, rawAudioProperties: IAudioMetadata, audioProperties: any, fileBuffer: Buffer
        try {
            fileName = req.query.name?.toString()
            if (!string().required().isValidSync(fileName)) {
                res.status(400).json({ message: 'Invalid file name' });
                return
            }
            console.log('fileName', fileName)

            const fileStream = Readable.from(req);
            fileBuffer = await streamToBuffer(fileStream)

            rawAudioProperties = await parseBuffer(fileBuffer);
            audioProperties = {
                title: rawAudioProperties.common.title!,
                file: {
                    format: rawAudioProperties.format.container!,
                    audioCodec: rawAudioProperties.format.codec!,
                    bitDepth: rawAudioProperties.format.bitsPerSample!,
                    bitrate: rawAudioProperties.format.bitrate!,
                    sampleRate: rawAudioProperties.format.sampleRate!,
                    size: fileBuffer.byteLength,
                    channels: rawAudioProperties.format.numberOfChannels!,
                    compressed: !rawAudioProperties.format.lossless!,
                    duration: rawAudioProperties.format.duration!,
                },
                musical: {
                    tempo: undefined,
                    key: undefined,
                    timeSignature: undefined,
                    pitch: undefined,
                    harmony: undefined,
                    melody: undefined,
                    instrumentations: undefined,
                    timbre: undefined,
                    loudness: undefined,
                    dynamicRange: undefined,
                    keySignature: undefined,
                },
                metadata: {
                    title: rawAudioProperties.common.title!,
                    album: rawAudioProperties.common.album,
                    artists: rawAudioProperties.common.artists!,
                    bpm: 0,
                    composer: rawAudioProperties.common.composer,
                    copyright: rawAudioProperties.common.copyright,
                    genre: rawAudioProperties.common.genre!,
                    language: rawAudioProperties.common.language,
                    lyricist: rawAudioProperties.common.lyricist,
                    lyrics: rawAudioProperties.common.lyrics,
                    moodOrEmotion: rawAudioProperties.common.mood,
                    publisher: rawAudioProperties.common.publisher,
                    trackNumber: rawAudioProperties.common.track.no!,
                    year: rawAudioProperties.common.year!,
                },
            }
            console.log('audioProperties', audioProperties)
        } catch (err) {
            console.error(err)
            res.status(400).json({ message: 'Invalid file' });
            return
        }

        console.log('Decoding to PCM...')
        const pcm = await decodeToPCM(fileBuffer);
        const pcmFloat = new Float32Array(pcm);

        console.log('Analyzing PCM data...')
        const features = await analyzeAudio(pcmFloat);
        audioProperties.metadata.bpm = features.bpm
        audioProperties.musical = {
            ...audioProperties.musical,
            tempo: features.bpm,
            key: `${features.key} ${features.scale}`,
            keySignature: `${features.key} ${features.scale}`,
            loudness: features.loudness,
        }

        console.log('Analysis', { ...features, beats: [] })
        console.log('audioProperties', audioProperties)

        res.status(200).json(audioProperties)

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Error uploading audio file' });
    }
})

router.post('/upload', auth, authorization, async (req, res) => {
    let db: MongoDB | undefined = undefined
    try {
        console.log('/upload')

        console.log('Validating...')
        let fileName: string | undefined,
            rawAudioProperties: IAudioMetadata,
            audioProperties: AudioMetadata,
            fileBuffer: Buffer
        try {
            fileName = req.query.name?.toString()
            console.log({ fileName })

            if (!string().required().isValidSync(fileName))
                return res.status(400).json({ message: 'Invalid file name' });

            console.log({ fileName })

            const fileStream = Readable.from(req);
            fileBuffer = await streamToBuffer(fileStream)

            rawAudioProperties = await parseBuffer(fileBuffer);
            audioProperties = {
                userId: (req as any).user.userId,
                temporary: true,
                contentType: req.headers['content-type'],
                title: rawAudioProperties.common.title!,
                file: {
                    format: rawAudioProperties.format.container!,
                    audioCodec: rawAudioProperties.format.codec!,
                    bitDepth: rawAudioProperties.format.bitsPerSample!,
                    bitrate: rawAudioProperties.format.bitrate!,
                    sampleRate: rawAudioProperties.format.sampleRate!,
                    size: fileBuffer.byteLength,
                    channels: rawAudioProperties.format.numberOfChannels!,
                    compressed: !rawAudioProperties.format.lossless!,
                    duration: rawAudioProperties.format.duration!,
                },
                musical: {
                    tempo: undefined,
                    key: undefined,
                    timeSignature: undefined,
                    pitch: undefined,
                    harmony: undefined,
                    melody: undefined,
                    instrumentations: undefined,
                    timbre: undefined,
                    loudness: undefined,
                    dynamicRange: undefined,
                    keySignature: undefined,
                },
                metadata: {
                    title: rawAudioProperties.common.title!,
                    album: rawAudioProperties.common.album,
                    artists: rawAudioProperties.common.artists!,
                    bpm: 0,
                    composer: rawAudioProperties.common.composer,
                    copyright: rawAudioProperties.common.copyright,
                    genre: rawAudioProperties.common.genre!,
                    language: rawAudioProperties.common.language,
                    lyricist: rawAudioProperties.common.lyricist,
                    lyrics: rawAudioProperties.common.lyrics,
                    moodOrEmotion: rawAudioProperties.common.mood,
                    publisher: rawAudioProperties.common.publisher,
                    trackNumber: rawAudioProperties.common.track.no!,
                    year: rawAudioProperties.common.year!,
                },
            }
            if (!audioSchema.isValidSync(audioProperties)) {
                res.status(400).json({ message: 'Invalid audio data' });
                return
            }
            console.log('audioProperties', audioProperties)
        } catch (err) {
            console.error(err)
            res.status(400).json({ message: 'Invalid file' });
            return
        }

        console.log('Decoding to PCM...')
        const pcm = await decodeToPCM(fileBuffer);
        const pcmFloat = new Float32Array(pcm);

        console.log('Analyzing PCM data...')
        const features = await analyzeAudio(pcmFloat);
        audioProperties.metadata.bpm = features.bpm
        audioProperties.musical = {
            ...audioProperties.musical,
            tempo: features.bpm,
            key: `${features.key} ${features.scale}`,
            keySignature: `${features.key} ${features.scale}`,
            loudness: features.loudness,
        }

        console.log('Analysis', { ...features, beats: [] })
        console.log('audioProperties', audioProperties)

        const coverArtRepository = new CoverArtRepository()
        const audioFileRepository = new AudioFileRepository()

        console.log("Inserting audio file...");
        const audioFileId = await audioFileRepository.upload(audioProperties, { fileName: fileName, bytes: fileBuffer })
        console.log("Upload audio file result", audioFileId);
        if (audioFileId === false || !audioFileId)
            return res.status(500).send()

        let coverArtId
        if (rawAudioProperties.common && rawAudioProperties.common.picture && rawAudioProperties.common.picture.length >= 0 && rawAudioProperties.common.picture[0].data) {
            console.log("Inserting cover art...");
            const buffer = Buffer.from(rawAudioProperties.common.picture[0].data);
            coverArtId = await coverArtRepository.upload({ userId: (req as any).user.userId, audioId: audioFileId, temporary: true, contentType: req.headers['content-type'] }, { fileName, bytes: buffer })
            console.log("Upload audio file result", coverArtId);
            if (coverArtId === false || !coverArtId)
                return res.status(500).send()
        }

        db = MongoDB.getDbInstance()
        const session = await db.startTransaction()

        audioFileRepository.setTransactionSession(session)
        coverArtRepository.setTransactionSession(session)

        const audioFileUpdateResult = await audioFileRepository.makePermanent(audioFileId)
        console.log({ audioFileUpdateResult })
        if (audioFileUpdateResult === false || !audioFileUpdateResult.acknowledged)
            return res.status(500).send()

        const coverArtFileUpdateResult = await coverArtRepository.makePermanent(coverArtId!)
        console.log({ coverArtFileUpdateResult })
        if (coverArtFileUpdateResult === false || !coverArtFileUpdateResult.acknowledged)
            return res.status(500).send()

        await db.commitTransaction()

        res.status(201).send();

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Error uploading audio file' });
    }
})

router.get('/info/', auth, async (req, res) => {
    try {
        console.log('/info')

        console.log('Validation...')
        let audioId: string | undefined = undefined
        let title: string | undefined = undefined
        try {
            audioId = req.query.audioId?.toString()
            title = req.query.title?.toString()

            if (!likeObjectId.optional().isValidSync(audioId)) {
                res.status(400).json({ message: 'Invalid audio id' });
                return
            }

            if (!string().optional().isValidSync(title)) {
                res.status(400).json({ message: 'Invalid title' });
                return
            }

            if (audioId === undefined && title === undefined) {
                res.status(400).json({ message: 'Invalid parameters' });
                return
            }
        } catch (err) {
            console.error(err)
            res.status(400).json({ message: 'Invalid parameters' });
            return
        }
        console.log({ audioId, title })

        const audioRepository = new AudioFileRepository()

        let result
        if (audioId)
            result = await audioRepository.getFile(audioId)
        else
            result = await audioRepository.getFileByTitle(title!)

        console.log({ result })

        res.status(200).json(result)

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio' });
    }
});

router.get('/file/:audioId', auth, async (req, res) => {
    try {
        console.log('/file')

        const audioId = req.params.audioId
        if (!likeObjectId.isValidSync(audioId)) {
            res.status(400).json({ message: 'Invalid audio id' });
            return
        }
        console.log('audioId', audioId)

        let range: number[] | undefined = undefined
        const rangeHeader = req.headers.range;

        const audioFileRepository = new AudioFileRepository()
        const file = await audioFileRepository.getFile(audioId)
        if (!file) {
            res.status(404).json({ message: 'Audio file not found' });
            return
        }
        console.log('file', file)

        console.log('rangeHeader', rangeHeader)
        if (!rangeHeader) {
            res.writeHead(200, {
                "Content-Length": file.length,
                "Content-Type": "audio/mpeg",
                "Accept-Ranges": "bytes",
            });
        } else {
            const rangeTemp = rangeHeader.replace(/bytes=/, "").split("-").map((v) => v ? parseInt(v, 10) : undefined).filter(f => f !== undefined);
            console.log({ rangeTemp })
            if (!array().of(number().strict(false).required().min(0).integer()).required().min(1).isValidSync(rangeTemp)) {
                res.status(416).json({ message: 'Invalid range provided' });
                return
            }

            if (rangeTemp.length === 1)
                rangeTemp[1] = file.length - 1;
            rangeTemp[1] = Math.min(rangeTemp[1], file.length - 1)

            range = rangeTemp as number[]
            console.log({ range })

            const chunkSize = range[1] - range[0] + 1;

            res.writeHead(206, {
                "Content-Range": `bytes ${range[0]}-${range[1]}/${file.length}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize,
                "Content-Type": "audio/mpeg",
            });
        }

        console.log('streaming...')
        audioFileRepository.downloadFile(res, file._id.toString(), range)

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting audio file' });
    }
});

router.get('/coverArt/:audioId', auth, async (req, res) => {
    try {
        console.log('/coverArt')

        const audioId = req.params.audioId
        if (!likeObjectId.isValidSync(audioId)) {
            res.status(400).json({ message: 'Invalid audio id' });
            return
        }

        console.log('Fetching cover art info...')
        const coverArtRepository = new CoverArtRepository()

        let file = await coverArtRepository.getFileByAudioId(audioId)
        console.log({ file })
        if (!file)
            return res.status(404).json({ message: 'Audio file not found' });

        console.log('file', file)

        res.setHeader("Content-Disposition", `attachment; filename="${file.filename}.${file.metadata!.contentType}"`);
        res.setHeader("Content-Type", file.metadata!.contentType);

        console.log('downloading...')
        coverArtRepository.downloadFile(res, file._id.toString())

        console.log('------------end------------')
    } catch (err) {
        res.status(500).json({ message: 'Error getting cover art' });
    }
});

router.delete('/:audioId', auth, authorization, async (req, res) => {
    let db: MongoDB | undefined = undefined
    try {
        console.log('Validation...');
        const audioId = req.params.audioId
        if (!likeObjectId.isValidSync(audioId))
            return res.status(400).json({ message: 'Error uploading audio file' });
        console.log({ audioId });

        db = MongoDB.getDbInstance()
        const session = await db.startTransaction()

        const audioRepository = new AudioFileRepository()
        audioRepository.setTransactionSession(session)

        const coverArtRepository = new CoverArtRepository()
        coverArtRepository.setTransactionSession(session)

        const audio = await audioRepository.getFile(audioId)
        if (!audio)
            return res.status(404).send()

        const audioDeleteResult = await audioRepository.deleteFile(audioId)
        if (audioDeleteResult !== true)
            res.status(500).json({ message: 'Couldn\'t delete audio' });

        const coverArtResult = await coverArtRepository.deleteFileByAudioId(audioId)
        if (coverArtResult !== true)
            res.status(500).json({ message: 'Couldn\'t delete audio cover art' });

        await db.commitTransaction()

        res.status(200).send()

        console.log('------------end------------')
    } catch (err) {
        if (db)
            await db.abortTransaction()
        res.status(500).json({ message: 'Error deleting audio' });
    }
});

export { router as audioRoutes };