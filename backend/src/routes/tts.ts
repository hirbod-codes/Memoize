// import express from 'express';
// import { auth } from '../middlewares/auth';
// import { generalRateLimiter } from '../middlewares/rateLimiting';
// import { Language, languageSchema, getTTSAudioStream, getSampleRate } from '../services/tts';
// import { string } from 'yup';
// import { decodePCMStreamToOutputStream } from '../ffmpeg';

// const router = express.Router();

// router.use(auth, generalRateLimiter)

// router.post("/", async (req, res) => {
//     console.log('/api/tts');

//     try {
//         console.log('Validation...');
//         let text: string, language: Language
//         try {
//             text = string().required().validateSync(req.body?.text.toString())
//             language = languageSchema.required().validateSync(req.body?.language.toString())
//         } catch (error) {
//             console.error(error);
//             return res.status(400).send()
//         }

//         res.setHeader("Content-Type", "audio/wav");

//         const tts = getTTSAudioStream(language)

//         const MAX_BYTES = 10 * 1024 * 1024 * 1024;
//         decodePCMStreamToOutputStream(getSampleRate(language), tts, res, MAX_BYTES)

//         tts.stdin.write(text);
//         tts.stdin.end();
//     } catch (err) {
//         console.error(err)
//         res.status(500).send()
//     }
// });

// export { router as ttsRoutes };
