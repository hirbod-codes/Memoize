import { InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'leaf'

export const schemaVersion = 'v1.0.0'

export const leafValidationSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: likeObjectId.required(),

    term: string().optional(),
    termType: string().optional().oneOf(['string', 'imageId', 'videoId', 'audioId']),

    definition: string().optional(),
    definitionType: string().optional().oneOf(['string', 'imageId', 'videoId', 'audioId']),

    createdAt: number().optional(),
    updatedAt: number().optional(),
});

export type Leaf = InferType<typeof leafValidationSchema>
