import { boolean, InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'video'

export const schemaVersion = 'v1.0.0'

const post = {
    title: string().required()
}
export const videoPostSchema = object().shape(post).required()

const create = {
    title: string().required()
}
export const videoCreateSchema = object().shape(create).required()

const update = {
    title: string().required()
}
export const videoUpdateSchema = object().shape(update).required()

export const videoSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: likeObjectId.required(),
    title: string().required(),

    temporary: boolean().required(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})

export type VideoPost = InferType<typeof videoPostSchema>
export type VideoCreate = InferType<typeof videoCreateSchema>
export type VideoUpdate = InferType<typeof videoUpdateSchema>
export type Video = InferType<typeof videoSchema>
