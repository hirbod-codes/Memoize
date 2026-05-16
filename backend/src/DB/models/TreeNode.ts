import { array, boolean, InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'treeNode'

export const schemaVersion = 'v1.0.0'

export const treeNodeValidationSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: likeObjectId.required(),

    root: boolean().required(),

    treeNodeIds: array().of(likeObjectId.required()).required().min(0),
    leafIds: array().of(likeObjectId.required()).required().min(0),

    createdAt: number().optional(),
    updatedAt: number().optional(),
});

export type TreeNode = InferType<typeof treeNodeValidationSchema>
