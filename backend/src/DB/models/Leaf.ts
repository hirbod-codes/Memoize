import { array, InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'leaf'

export const schemaVersion = 'v1.0.0'

const contentTypesSchema = string().oneOf(['string', 'richText', 'imageId', 'videoId', 'audioId'])
const contentSchema = object().shape({ type: contentTypesSchema.required(), value: array().of(string().required()).required().min(1) })
const contentsSchema = array().of(contentSchema.required())

const data = {
    title: string().required(),
    termContents: contentsSchema.required().min(0),
    definitionContents: contentsSchema.required().min(0),
}

const leafCreate = {
    userId: likeObjectId.required(),
    treeNodeId: likeObjectId.required(),
    ...data,
}

export const leafCreateSchema = object().required().shape({ ...leafCreate })

export const leafUpdateSchema = object().required().shape({ ...data, _id: likeObjectId.optional() })

export const leafSchema = object().required().shape(leafCreate).shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
});

export type ContentTypes = InferType<typeof contentTypesSchema>
export type Content = InferType<typeof contentSchema>
export type Contents = InferType<typeof contentsSchema>
export type LeafCreate = InferType<typeof leafCreateSchema>
export type LeafUpdate = InferType<typeof leafUpdateSchema>
export type Leaf = InferType<typeof leafSchema>
