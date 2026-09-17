import { number, object, string } from "yup";
import { DEFAULT_PAGE_SIZE, MAX_PAGE, MAX_PAGE_SIZE } from "../schemas";

export const postImageSchema = object().required().shape({
    title: string().required().label('Title'),
    fileName: string().required().label('File name'),
});

export const listQuerySchema = object().required().shape({
    page: number().integer().min(1).max(MAX_PAGE).default(1).label('Page'),
    pageSize: number().integer().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).label('Page size'),
});

export const infoQuerySchema = object().required().shape({
    imageId: string().objectIdString().optional().label('Image id').when('title', {
        is: (title: any) => !title || title === null || title === undefined,
        then(schema) {
            return schema.required()
        },
        otherwise(schema) {
            return schema.notRequired()
        },
    }),
    title: string().optional().label('Title').when('imageId', {
        is: (imageId: any) => !imageId || imageId === null || imageId === undefined,
        then(schema) {
            return schema.required()
        },
        otherwise(schema) {
            return schema.notRequired()
        },
    }),
}, [['imageId', 'title']])

export const fileParamsSchema = object().required().shape({
    imageId: string().objectIdString().required().label('image id'),
    download: string().optional().label('Download'),
});

export const deleteParamsSchema = object().required().shape({
    imageId: string().objectIdString().required().label('Image id'),
});
