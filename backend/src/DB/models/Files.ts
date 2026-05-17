import { array, boolean, InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const avatarCollectionName = "avatarFile"
export const avatarSchema = object().shape({
    userId: likeObjectId.required(),

    temporary: boolean().required(),

    contentType: string().optional(),
})
export type AvatarMetadata = InferType<typeof avatarSchema>

export const imageCollectionName = "imageFile"
export const imageSchema = object().shape({
    userId: likeObjectId.required(),

    temporary: boolean().required(),

    contentType: string().optional(),
})
export type ImageMetadata = InferType<typeof imageSchema>

export const videoCollectionName = "videoFile"
export const videoSchema = object().shape({
    userId: likeObjectId.required(),

    temporary: boolean().required(),

    contentType: string().optional(),
})
export type VideoMetadata = InferType<typeof videoSchema>

export const audioCollectionName = "audioFile"
export const audioSchema = object().shape({
    userId: likeObjectId.required(),

    temporary: boolean().required(),

    contentType: string().optional(),

    title: string().required("Title is required"), // The name of the song or track.

    file: object().shape({
        format: string().required("Format is required"), //e.g., .mp3, .wav, .flac, .aac, .ogg, .m4a.
        size: number().required("Size is required"), // In bytes.
        bitrate: number().required("Bitrate is required"), // The data rate at which the audio is encoded, typically measured in kbps.
        duration: number().required("Duration is required"),
        sampleRate: number().required("Sample rate is required"), // The number of samples of audio carried per second, typically 44.1 kHz or 48 kHz for consumer audio.
        channels: number().required("Channels is required"), // Mono (1), Stereo (2), or Surround (5.1, 7.1, etc.).
        compressed: boolean().required("Compressed is required"), // Whether the file is compressed (lossy(e.g., MP3, AAC) or lossless(e.g., FLAC, WAV)).
        audioCodec: string().required("Audio codec is required"), // Compression format (e.g., MP3, AAC, Opus, etc.).
        bitDepth: number().required("Bit depth is required"), // The number of bits used to represent each sample of audio (e.g., 16-bit, 24-bit).
    }),

    musical: object().shape({
        tempo: number().optional(), // The speed of the music, usually measured in beats per minute (BPM).
        key: string().optional(), // The musical key in which the track is composed (e.g., C major, A minor).
        timeSignature: string().optional(), // Defines the number of beats in a measure and which note value is equivalent to a beat (e.g., 4/4, 3/4).
        pitch: number().optional(), // The perceived frequency of the notes in the track.
        harmony: string().optional(), // The combination of different musical notes played simultaneously to create chords.
        melody: string().optional(), // The sequence of notes that make up the main tune of a song.
        instrumentations: string().optional(), // The specific instruments used in the track (e.g., guitar, piano, drums).
        timbre: string().optional(), // The unique quality or color of the sound produced by different instruments.
        loudness: number().optional(), // The perceived volume of the track, often measured in decibels(dB).
        dynamicRange: string().optional(), // The range between the softest and loudest parts of a track.
        keySignature: string().optional(), // A symbol indicating the key of a musical piece(e.g., 2 sharps for D major).
    }),

    metadata: object().shape({
        title: string().required("Title is required"), // The name of the song or track.
        artists: array().of(string().required()).optional(), // The performer or composer of the track.
        album: string().optional(), // The album to which the track belongs.
        trackNumber: number().optional(), // The position of the track in the album.
        genre: array().of(string().required()).optional(), // The musical genre of the track (e.g., Rock, Pop, Jazz, Classical).
        year: number().optional(), // The year the track was released or recorded.
        composer: array().of(string().optional()).optional(), // The individual who composed the track.
        copyright: string().optional(), // The copyright information associated with the track.
        lyricist: array().of(string().required()).optional(), // The lyricist of the song (if available).
        lyrics: array().of(object().shape({
            contentType: number().optional(), // 0: Standard lyrics. 1: Lyrics for synchronizing with a media player (for example, synced karaoke lyrics).
            timeStampFormat: number().optional(), // 0: Unsynchronized lyrics. 1: Synchronized timestamps.
            text: string().optional(), // Un-synchronized lyrics
            syncText: array().of(object().shape({
                text: string().optional(),
                timestamp: number().optional(),
            }).optional()).optional(), // If the lyrics are synchronized, this field would contain an array of strings representing the timed sections of the lyrics. Each string in the array corresponds to a part of the lyrics that is synchronized with a specific timestamp in the song.
        }).required()).optional(), // The lyrics of the song (if available).
        language: string().optional(), // The language in which the track is performed.
        publisher: array().of(string().required()).optional(), // The record label or music publisher associated with the track.
        bpm: number().optional(), // The beats per minute (sometimes included in metadata).
        moodOrEmotion: string().optional(), // Some tracks may include a mood or emotional description (e.g., happy, sad, energetic).
    }),
});
export type AudioMetadata = InferType<typeof audioSchema>

export const coverArtCollectionName = "coverArtFile"
export const coverArtSchema = object().shape({
    userId: likeObjectId.required(),

    audioId: likeObjectId.required(),

    temporary: boolean().required(),

    contentType: string().optional(),
})
export type CoverArtMetadata = InferType<typeof coverArtSchema>
