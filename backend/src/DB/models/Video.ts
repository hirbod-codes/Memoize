import { boolean, InferType, number, object, string } from 'yup';
import { contentTypeSchema, likeObjectId } from '../common_schemas';

export const collectionName = 'video'

export const schemaVersion = 'v1.0.0'

const post = {
    title: string().required().label('Title'),
}
export const videoPostSchema = object().shape(post).required()

const create = {
    userId: likeObjectId.required(),
    contentType: contentTypeSchema.optional(),
    title: string().required().label('Title'),
    fileName: string().required().label('File name'),
    thumbnailFileName: string().optional().label('Thumbnail file name'),
    bucketKey: string().optional().url(), // video/${userId}/${videoId}
    webBucketKey: string().optional().url(), // audio/<userId>/web/<audioId>
    thumbnailKey: string().optional().url(), // video/thumbnail/${userId}/${videoId}
    temporary: boolean().required(),
}
export const videoCreateSchema = object().shape(create).required()

const patch = {
    title: string().required().label('Title'),
}
export const videoPatchSchema = object().shape(patch).required()

const update = {
    schemaVersion: string().optional().min(6).max(20),
    userId: likeObjectId.optional(),

    contentType: contentTypeSchema.optional(),
    title: string().optional().label('Title'),
    fileName: string().optional().label('File name'),
    thumbnailFileName: string().optional().label('Thumbnail file name'),

    bucketKey: string().optional().url(), // video/${userId}/${videoId}
    webBucketKey: string().optional().url(), // audio/<userId>/web/<audioId>
    thumbnailKey: string().optional().url(), // video/thumbnail/${userId}/${videoId}

    temporary: boolean().optional(),
}
export const videoUpdateSchema = object().shape(update).required()

export const videoSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: likeObjectId.required(),

    contentType: contentTypeSchema.optional(),
    title: string().required().label('Title'),
    fileName: string().required().label('File name'),
    thumbnailFileName: string().optional().label('Thumbnail file name'),

    bucketKey: string().optional().url(), // video/${userId}/${videoId}
    webBucketKey: string().optional().url(), // audio/<userId>/web/<audioId>
    thumbnailKey: string().optional().url(), // video/thumbnail/${userId}/${videoId}

    temporary: boolean().required(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})

export type VideoPost = InferType<typeof videoPostSchema>
export type VideoCreate = InferType<typeof videoCreateSchema>
export type VideoPatch = InferType<typeof videoPatchSchema>
export type VideoUpdate = InferType<typeof videoUpdateSchema>
export type Video = InferType<typeof videoSchema>
