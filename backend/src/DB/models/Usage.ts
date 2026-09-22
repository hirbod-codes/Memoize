import { InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'usage'

export const schemaVersion = 'v1.0.0'

const positiveInteger = number().integer().moreThan(-1)

const post = {
    storageBytesCount: positiveInteger.required(),
}
export const usagePostSchema = object().shape(post).required()

const create = {
    userId: likeObjectId.required(),

    storageBytesCount: positiveInteger.required(),
}
export const usageCreateSchema = object().shape(create).required()

const update = {
    storageBytesCount: positiveInteger.optional(),
}
export const usageUpdateSchema = object().shape(update).required()

export const usageSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: likeObjectId.required(),

    storageBytesCount: positiveInteger.required(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})

export type UsagePost = InferType<typeof usagePostSchema>
export type UsageCreate = InferType<typeof usageCreateSchema>
export type UsageUpdate = InferType<typeof usageUpdateSchema>
export type Usage = InferType<typeof usageSchema>
