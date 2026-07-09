import { boolean, InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'audio'

export const schemaVersion = 'v1.0.0'

const post = {
    title: string().required().label('Title'),
}
export const audioPostSchema = object().shape(post).required()

const create = {
    userId: likeObjectId.required(),
    contentType: string().required(),
    title: string().required().label('Title'),
    fileName: string().required().label('File name'),
    coverArtFileName: string().optional().label('Cover art file name'),
    bucketKey: string().required().url(), // audio/<userId>/<fileName>
    coverArtKey: string().optional().url(), // audio/cover_art/<userId>/<title>
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

    contentType: string().optional(),
    title: string().optional().label('Title'),
    fileName: string().optional().label('File name'),
    coverArtFileName: string().optional().label('Cover art file name'),

    bucketKey: string().optional().url(), // audio/<userId>/<fileName>
    coverArtKey: string().optional().url(), // audio/cover_art/<userId>/<title>

    temporary: boolean().optional(),
}
export const audioUpdateSchema = object().shape(update).required()

export const audioSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: likeObjectId.required(),

    contentType: string().required(),
    title: string().required().label('Title'),
    fileName: string().required().label('File name'),
    coverArtFileName: string().optional().label('Cover art file name'),

    bucketKey: string().required().url(), // audio/<userId>/<fileName>
    coverArtKey: string().optional().url(), // audio/cover_art/<userId>/<title>

    temporary: boolean().required(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})

export type AudioPost = InferType<typeof audioPostSchema>
export type AudioCreate = InferType<typeof audioCreateSchema>
export type AudioPatch = InferType<typeof audioPatchSchema>
export type AudioUpdate = InferType<typeof audioUpdateSchema>
export type Audio = InferType<typeof audioSchema>
