import { boolean, InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'video'

export const schemaVersion = 'v1.0.0'

export const videoSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: likeObjectId.required(),
    title: string().required(),

    temporary: boolean().required(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})
export type Video = InferType<typeof videoSchema>
