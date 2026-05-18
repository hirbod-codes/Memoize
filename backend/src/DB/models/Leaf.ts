import { array, InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'leaf'

export const schemaVersion = 'v1.0.0'

const contentSchema = object().shape({ type: string().required().oneOf(['string', 'imageId', 'videoId', 'audioId']), value: array().of(string().required()).required().min(1) })
const contentsSchema = array().of(contentSchema.required())

export const leafValidationSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: likeObjectId.required(),

    title: string().required(),

    termContents: contentsSchema.required().min(0),
    definitionContents: contentsSchema.required().min(0),

    createdAt: number().optional(),
    updatedAt: number().optional(),
});

export type Content = InferType<typeof contentSchema>
export type Contents = InferType<typeof contentsSchema>
export type Leaf = InferType<typeof leafValidationSchema>
