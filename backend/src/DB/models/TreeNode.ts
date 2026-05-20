import { array, boolean, InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'treeNode'

export const schemaVersion = 'v1.0.0'

const data = {
    title: string().required(),
}
const treeNodeCreate = {
    userId: likeObjectId.required(),
    parentId: likeObjectId.optional(),
    ...data
}
export const treeNodeCreateSchema = object().required().shape(treeNodeCreate)
export const treeNodeUpdateSchema = object().required().shape({ ...data, _id: likeObjectId.required() })

export const treeNodeSchema = object().required().shape(treeNodeCreate).shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
});

export type TreeNodeUpdate = InferType<typeof treeNodeUpdateSchema>
export type TreeNodeCreate = InferType<typeof treeNodeCreateSchema>
export type TreeNode = InferType<typeof treeNodeSchema>
