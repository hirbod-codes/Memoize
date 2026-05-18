import { array, InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'leaf'

export const schemaVersion = 'v1.0.0'

const contentTypesSchema = string().oneOf(['string', 'richText', 'imageId', 'videoId', 'audioId'])
const contentSchema = object().shape({ type: contentTypesSchema.required(), value: array().of(string().required()).required().min(1) })
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

export type ContentTypes = InferType<typeof contentTypesSchema>
export type Content = InferType<typeof contentSchema>
export type Contents = InferType<typeof contentsSchema>
export type Leaf = InferType<typeof leafValidationSchema>
