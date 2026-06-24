import { boolean, InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'image'

export const schemaVersion = 'v1.0.0'

const post = {
    title: string().required().label('Title'),
}
export const imagePostSchema = object().shape(post).required()

const create = {
    userId: likeObjectId.required(),
    contentType: string().required(),
    title: string().required().label('Title'),
    bucketKey: string().required().url(), // image/<userId>/<fileName>
    temporary: boolean().required(),
}
export const imageCreateSchema = object().shape(create).required()

const patch = {
    title: string().required().label('Title'),
}
export const imagePatchSchema = object().shape(patch).required()

const update = {
    schemaVersion: string().optional().min(6).max(20),
    userId: likeObjectId.optional(),

    contentType: string().optional(),
    title: string().optional().label('Title'),
    fileName: string().optional().label('File name'),

    bucketKey: string().optional().url(), // image/<userId>/<fileName>

    temporary: boolean().optional(),
}
export const imageUpdateSchema = object().shape(update).required()

export const imageSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: likeObjectId.required(),

    contentType: string().required(),
    title: string().required().label('Title'),
    fileName: string().required().label('File name'),

    bucketKey: string().required().url(), // image/<userId>/<fileName>

    temporary: boolean().required(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})

export type ImagePost = InferType<typeof imagePostSchema>
export type ImageCreate = InferType<typeof imageCreateSchema>
export type ImagePatch = InferType<typeof imagePatchSchema>
export type ImageUpdate = InferType<typeof imageUpdateSchema>
export type Image = InferType<typeof imageSchema>
