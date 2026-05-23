import express from 'express';
import { Readable } from 'stream';
import { IAudioMetadata, parseBuffer } from 'music-metadata';
import { AudioFileRepository } from '../DB/repositories/AudioFileRepository';
import { CoverArtRepository } from '../DB/repositories/CoverArtRepository';
import { decodeToPCM } from '../ffmpeg';
import { analyzeAudio } from '../essentia';
import { streamToBuffer } from '../utils';
import { array, number, string, ValidationError } from 'yup';
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
            fileName = await string().required().label('File name').validate(req.query.name?.toString())
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

router.post('/', auth, authorization, async (req, res) => {
    try {
        console.log('/upload')

        console.log('Validating...')
        let fileName: string | undefined, fileBuffer: Buffer, title: string | undefined,
            rawAudioProperties: IAudioMetadata = {
                common: {
                    picture: [],
                    track: {
                        no: null,
                        of: null
                    },
                    disk: {
                        no: null,
                        of: null
                    },
                    movementIndex: {
                        no: null,
                        of: null
                    }
                },
                format: {
                    trackInfo: [],
                    tagTypes: []
                },
                native: {},
                quality: {
                    warnings: []
                }
            },
            audioProperties: AudioMetadata = {
                title: '',
                userId: (req as any).user.userId,
                temporary: true,
                contentType: req.headers['content-type'],
                file: {
                    format: '',
                    size: 0,
                    bitrate: 0,
                    duration: 0,
                    sampleRate: 0,
                    channels: 0,
                    compressed: false,
                    audioCodec: '',
                    bitDepth: 0
                },
                musical: {},
                metadata: {
                    title: ''
                }
            };
        try {
            title = await string().required().label('Title').validate(req.query.title?.toString())
            fileName = await string().required().label('File name').validate(req.query.fileName?.toString())
            console.log({ fileName })

            const fileStream = Readable.from(req);
            fileBuffer = await streamToBuffer(fileStream)

            audioProperties.title = title
            audioProperties.metadata.title = title
            // rawAudioProperties = await parseBuffer(fileBuffer);
            // audioProperties = {
            //     userId: (req as any).user.userId,
            //     temporary: true,
            //     contentType: req.headers['content-type'],
            //     title: rawAudioProperties.common.title!,
            //     file: {
            //         format: rawAudioProperties.format.container!,
            //         audioCodec: rawAudioProperties.format.codec!,
            //         bitDepth: rawAudioProperties.format.bitsPerSample!,
            //         bitrate: rawAudioProperties.format.bitrate!,
            //         sampleRate: rawAudioProperties.format.sampleRate!,
            //         size: fileBuffer.byteLength,
            //         channels: rawAudioProperties.format.numberOfChannels!,
            //         compressed: !rawAudioProperties.format.lossless!,
            //         duration: rawAudioProperties.format.duration!,
            //     },
            //     musical: {
            //         tempo: undefined,
            //         key: undefined,
            //         timeSignature: undefined,
            //         pitch: undefined,
            //         harmony: undefined,
            //         melody: undefined,
            //         instrumentations: undefined,
            //         timbre: undefined,
            //         loudness: undefined,
            //         dynamicRange: undefined,
            //         keySignature: undefined,
            //     },
            //     metadata: {
            //         title: rawAudioProperties.common.title!,
            //         album: rawAudioProperties.common.album,
            //         artists: rawAudioProperties.common.artists!,
            //         bpm: 0,
            //         composer: rawAudioProperties.common.composer,
            //         copyright: rawAudioProperties.common.copyright,
            //         genre: rawAudioProperties.common.genre!,
            //         language: rawAudioProperties.common.language,
            //         lyricist: rawAudioProperties.common.lyricist,
            //         lyrics: rawAudioProperties.common.lyrics,
            //         moodOrEmotion: rawAudioProperties.common.mood,
            //         publisher: rawAudioProperties.common.publisher,
            //         trackNumber: rawAudioProperties.common.track.no!,
            //         year: rawAudioProperties.common.year!,
            //     },
            // }
            // if (!audioSchema.isValidSync(audioProperties)) {
            //     res.status(400).json({ message: 'Invalid audio data' });
            //     return
            // }
            console.log('audioProperties', audioProperties)
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }

        // console.log('Decoding to PCM...')
        // const pcm = await decodeToPCM(fileBuffer);
        // const pcmFloat = new Float32Array(pcm);

        // console.log('Analyzing PCM data...')
        // const features = await analyzeAudio(pcmFloat);
        // audioProperties.metadata.bpm = features.bpm
        // audioProperties.musical = {
        //     ...audioProperties.musical,
        //     tempo: features.bpm,
        //     key: `${features.key} ${features.scale}`,
        //     keySignature: `${features.key} ${features.scale}`,
        //     loudness: features.loudness,
        // }

        // console.log('Analysis', { ...features, beats: [] })
        // console.log('audioProperties', audioProperties)

        const coverArtRepository = new CoverArtRepository()
        const audioFileRepository = new AudioFileRepository()

        console.log("Inserting audio file...");
        const audioFileId = await audioFileRepository.upload(audioProperties, { fileName: fileName, bytes: fileBuffer })
        console.log("Upload audio file result", audioFileId);
        if (audioFileId === false || !audioFileId)
            return res.status(500).send()

        let coverArtId
        if (rawAudioProperties.common && rawAudioProperties.common.picture && rawAudioProperties.common.picture.length >= 0 && rawAudioProperties.common.picture[0] && rawAudioProperties.common.picture[0].data) {
            console.log("Inserting cover art...");
            const buffer = Buffer.from(rawAudioProperties.common.picture[0].data);
            coverArtId = await coverArtRepository.upload({ userId: (req as any).user.userId, audioId: audioFileId, temporary: true, contentType: req.headers['content-type'] }, { fileName, bytes: buffer })
            console.log("Upload audio file result", coverArtId);
            if (coverArtId === false || !coverArtId)
                return res.status(500).send()
        }

        console.log({ coverArtId, audioFileId })

        res.status(201).json({ coverArtId, id: audioFileId });

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
            audioId = await string().objectIdString().optional().label('Audio id').validate(req.query.audioId?.toString())
            title = await string().optional().label('Title').validate(req.query.title?.toString())

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

        console.log('Validation...')
        let audioId: string | undefined = undefined
        try {
            audioId = await string().objectIdString().required().label('Audio id').validate(req.params.audioId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ audioId })

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

        console.log('Validation...')
        let audioId: string | undefined = undefined, title: string | undefined
        try {
            audioId = await string().objectIdString().required().label('Audio id').validate(req.params.audioId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ audioId })

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
        console.log('Validation...')
        let audioId: string | undefined = undefined
        try {
            audioId = await string().objectIdString().required().label('Audio id').validate(req.params.audioId?.toString())
        } catch (err) {
            console.error(err)
            if (err instanceof ValidationError)
                return res.status(400).json({ errors: err.errors })
            return res.status(400).json({ message: 'Invalid Tree node' });
        }
        console.log({ audioId })

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