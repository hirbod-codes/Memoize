import { boolean, InferType, number, object, string } from 'yup';
import { contentTypeSchema, likeObjectId } from '../common_schemas';

export const collectionName = 'audio'

export const schemaVersion = 'v1.0.0'

const post = {
    title: string().required().label('Title'),
}
export const audioPostSchema = object().shape(post).required()

const create = {
    userId: likeObjectId.required(),
    contentType: contentTypeSchema.optional(),
    title: string().required().label('Title'),
    coverArtFileName: string().optional().label('Cover art file name'),
    bucketKey: string().optional().url(), // audio/<userId>/<audioId>
    webBucketKey: string().optional().url(), // audio/<userId>/web/<audioId>
    coverArtKey: string().optional().url(), // audio/cover_art/<userId>/<audioId>
    temporary: boolean().required(),
}
export const audioCreateSchema = object().shape(create).required()

const patch = {
    title: string().required().label('Title'),
}
export const audioPatchSchema = object().shape(patch).required()

const update = {
    schemaVersion: string().optional().min(6).max(20),
    userId: likeObjectId.optional(),

    contentType: contentTypeSchema.optional(),
    title: string().optional().label('Title'),
    coverArtFileName: string().optional().label('Cover art file name'),

    bucketKey: string().optional().url(), // audio/<userId>/<audioId>
    webBucketKey: string().optional().url(), // audio/<userId>/web/<audioId>
    coverArtKey: string().optional().url(), // audio/cover_art/<userId>/<audioId>

    temporary: boolean().optional(),
}
export const audioUpdateSchema = object().shape(update).required()

export const audioSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: likeObjectId.required(),

    contentType: contentTypeSchema.optional(),
    title: string().required().label('Title'),
    coverArtFileName: string().optional().label('Cover art file name'),

    bucketKey: string().optional().url(), // audio/<userId>/<audioId>
    webBucketKey: string().optional().url(), // audio/<userId>/web/<audioId>
    coverArtKey: string().optional().url(), // audio/cover_art/<userId>/<audioId>

    temporary: boolean().required(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})

export type AudioPost = InferType<typeof audioPostSchema>
export type AudioCreate = InferType<typeof audioCreateSchema>
export type AudioPatch = InferType<typeof audioPatchSchema>
export type AudioUpdate = InferType<typeof audioUpdateSchema>
export type Audio = InferType<typeof audioSchema>
