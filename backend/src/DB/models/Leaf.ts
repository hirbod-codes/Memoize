import { array, InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'leaf'

export const schemaVersion = 'v1.0.0'

const contentTypesSchema = string().oneOf(['string', 'richText', 'imageId', 'videoId', 'audioId'])
const contentSchema = object().shape({ type: contentTypesSchema.required(), value: array().of(string().nonUndefined().optional().nonNullable()).required().min(0) })
const contentsSchema = array().of(contentSchema.required())

const post = {
    treeNodeId: string().objectIdString().required().label('Tree node id'),
    title: string().required().label('Title'),
    termContents: contentsSchema.required().min(0).label('Term contents'),
    definitionContents: contentsSchema.required().min(0).label('Definition contents'),
}

const update = {
    _id: string().objectIdString().required().label('Id'),
    treeNodeId: string().objectIdString().optional().label('Tree node id'),
    title: string().optional().label('Title'),
    termContents: contentsSchema.optional().nonNullable().min(0).label('Term contents'),
    definitionContents: contentsSchema.optional().nonNullable().min(0).label('Definition contents'),
}

const leafCreate = {
    userId: string().objectIdString().required().label('User'),
    treeNodeId: string().objectIdString().required().label('Tree node id'),
    title: string().required().label('Title'),
    termContents: contentsSchema.required().min(0).label('Term contents'),
    definitionContents: contentsSchema.required().min(0).label('Definition contents'),
}

export const leafPostSchema = object().required().shape(post)

export const leafCreateSchema = object().required().shape(leafCreate)

export const leafUpdateSchema = object().required().shape(update)

export const leafSchema = object().required().shape(leafCreate).shape({
    schemaVersion: string().optional().min(6).max(20).label('Schema version'),
    _id: likeObjectId.optional().label('Id'),

    userId: string().objectIdString().required().label('User id'),
    treeNodeId: string().objectIdString().required().label('Tree node id'),

    title: string().required().label('Title'),
    termContents: contentsSchema.required().min(0).label('Term contents'),
    definitionContents: contentsSchema.required().min(0).label('Definition contents'),

    createdAt: number().optional().label('Created at'),
    updatedAt: number().optional().label('Updated at'),
});

export type ContentTypes = InferType<typeof contentTypesSchema>
export type Content = InferType<typeof contentSchema>
export type Contents = InferType<typeof contentsSchema>

export type LeafPost = InferType<typeof leafPostSchema>
export type LeafCreate = InferType<typeof leafCreateSchema>
export type LeafUpdate = InferType<typeof leafUpdateSchema>

export type Leaf = InferType<typeof leafSchema>
