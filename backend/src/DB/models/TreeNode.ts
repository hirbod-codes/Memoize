import { array, InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'treeNode'

export const schemaVersion = 'v1.0.0'

const post = {
    parentId: string().objectIdString().optional().label('Parent id'),
    title: string().required().label('Title'),
}

const update = {
    _id: string().objectIdString().required().label('Id'),
    parentId: string().objectIdString().nullable().optional().label('Parent id'),
    title: string().optional().label('Title'),
}

const create = {
    userId: string().objectIdString().required().label('User'),
    parentId: string().objectIdString().nullable().optional().label('Parent id'),
    title: string().required().label('Title'),
}

export const treeNodeCreateSchema = object().required().shape(create)
export const treeNodePostSchema = object().required().shape(post)
export const treeNodeUpdateSchema = object().required().shape(update)

export const treeNodeSchema = object().required().shape(create).shape({
    schemaVersion: string().optional().min(6).max(20).label('Schema version'),
    _id: likeObjectId.optional().label('Id'),

    userId: string().objectIdString().required().label('User id'),
    parentId: string().objectIdString().nullable().optional().label('Parent id'),
    title: string().required().label('Title'),

    createdAt: number().optional().label('Created at'),
    updatedAt: number().optional().label('Updated at'),
});

export type TreeNodeCreate = InferType<typeof treeNodeCreateSchema>
export type TreeNodePost = InferType<typeof treeNodePostSchema>
export type TreeNodeUpdate = InferType<typeof treeNodeUpdateSchema>
export type TreeNode = InferType<typeof treeNodeSchema>
