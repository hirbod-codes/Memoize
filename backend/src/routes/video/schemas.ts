import { number, string, object } from "yup";
import { DEFAULT_PAGE_SIZE, MAX_PAGE, MAX_PAGE_SIZE } from "../schemas";

export const postSchema = object().required().shape({
    title: string().required().label('Title'),
    fileName: string().required().label('File name'),
})

export const listSchema = object().required().shape({
    page: number().integer().min(1).max(MAX_PAGE).default(1).label('Page'),
    pageSize: number().integer().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).label('Page size'),
})

export const infoSchema = object().required().shape({
    videoId: string().objectIdString().when('title', {
        is: (title: any) => !title || title === null || title === undefined,
        then(schema) {
            return schema.required()
        },
        otherwise(schema) {
            return schema.notRequired()
        },
    }).label('Video id'),
    title: string().label('Title').when('videoId', {
        is: (videoId: any) => !videoId || videoId === null || videoId === undefined,
        then(schema) {
            return schema.required()
        },
        otherwise(schema) {
            return schema.notRequired()
        },
    }),
}, [['videoId', 'title']])

export const signedTokenSchema = object().required().shape({
    videoId: string().objectIdString().required().label('Video id')
})

export const videoStreamSchema = object().required().shape({
    videoId: string().objectIdString().required().label('Video id')
})

export const videoStreamForWebClientsSchema = object().required().shape({
    videoId: string().objectIdString().required().label('Video id'),
    token: string().required().label('Token')
})

export const thumbnailSchema = object().required().shape({
    videoId: string().objectIdString().required().label('Video id'),
    download: string().optional().label('Download')
})

export const videoDeleteSchema = object().required().shape({
    videoId: string().objectIdString().required().label('Video id'),
})
