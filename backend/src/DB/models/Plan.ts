import { boolean, InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';
import { UsageField } from './Usage';

export const collectionName = 'plan'

const positiveInteger = number().integer().moreThan(-1)

const priceSchema = object().shape({
    IRR: number().required().integer().min(0),
    IRT: number().required().integer().min(0),
    USD: number().required().integer().min(0),
    EUR: number().required().integer().min(0),
    BTC: number().required().integer().min(0),
    ETH: number().required().integer().min(0),
})

const privilegesSchema = object().shape({
    maxCategories: positiveInteger.required(),
    maxNestedCategories: positiveInteger.required(),
    maxCardsPerCategory: positiveInteger.required(),
    maxContentsPerCardSide: positiveInteger.required(),
    maxStorageBytes: positiveInteger.required(),
    maxValuePerContent: object().required().shape({
        string: positiveInteger.required(),
        richText: positiveInteger.required(),
        image: positiveInteger.required(),
        audio: positiveInteger.required(),
        video: positiveInteger.required()
    }),
    allowedContentTypes: object().required().shape({
        string: boolean().required(),
        richText: boolean().required(),
        image: boolean().required(),
        audio: boolean().required(),
        video: boolean().required()
    }),
})

export const schemaVersion = 'v1.0.0'

const post = {
    title: string().required().label('Title'),
    price: priceSchema.required().label('Price'),
    privileges: privilegesSchema.required(),
}
export const planPostSchema = object().shape(post).required()

const create = {
    title: string().required().label('Title'),
    privileges: privilegesSchema.required(),
    price: priceSchema.required().label('Price'),
}
export const planCreateSchema = object().shape(create).required()


const update = {
    schemaVersion: string().optional().min(6).max(20),

    title: string().optional().label('Title'),
    price: priceSchema.optional().label('Price'),
    privileges: privilegesSchema.optional(),
}
export const planUpdateSchema = object().shape(update).required()

export const planSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    title: string().required().label('Title'),

    price: priceSchema.required().label('Price'),

    privileges: privilegesSchema.required(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})


export type Privileges = InferType<typeof privilegesSchema>
export type QuotaField = Exclude<keyof Privileges, 'allowedContentTypes' | 'maxValuePerContent'> | `maxValuePerContent.${keyof Privileges['maxValuePerContent'] & string}`
export type FeatureField = `allowedContentTypes.${keyof Privileges['allowedContentTypes'] & string}`

export type PlanPost = InferType<typeof planPostSchema>
export type PlanCreate = InferType<typeof planCreateSchema>
export type PlanUpdate = InferType<typeof planUpdateSchema>
export type Plan = InferType<typeof planSchema>
