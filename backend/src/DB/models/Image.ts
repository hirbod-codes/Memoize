import { boolean, InferType, number, object, string } from 'yup';
import { contentTypeSchema, likeObjectId } from '../common_schemas';

export const collectionName = 'image'

export const schemaVersion = 'v1.0.0'

const post = {
    title: string().required().label('Title'),
}
export const imagePostSchema = object().shape(post).required()

const create = {
    userId: likeObjectId.required(),
    contentType: contentTypeSchema.optional(),
    title: string().required().label('Title'),
    bucketKey: string().optional().url(), // image/<userId>/<imageId>
    temporary: boolean().required(),
}
export const imageCreateSchema = object().shape(create).required()

const update = {
    schemaVersion: string().optional().min(6).max(20),
    userId: likeObjectId.optional(),

    contentType: contentTypeSchema.optional(),
    title: string().optional().label('Title'),

    bucketKey: string().optional().url(), // image/<userId>/<imageId>

    temporary: boolean().optional(),
}
export const imageUpdateSchema = object().shape(update).required()

export const imageSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: likeObjectId.required(),

    contentType: contentTypeSchema.optional(),
    title: string().required().label('Title'),

    bucketKey: string().optional().url(), // image/<userId>/<imageId>

    temporary: boolean().required(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})

export type ImagePost = InferType<typeof imagePostSchema>
export type ImageCreate = InferType<typeof imageCreateSchema>
export type ImageUpdate = InferType<typeof imageUpdateSchema>
export type Image = InferType<typeof imageSchema>
