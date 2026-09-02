import { InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';
import { QuotaField } from './Plan';

export const collectionName = 'usage'

export const schemaVersion = 'v1.0.0'

const positiveInteger = number().integer().moreThan(-1)

const valuePerContentCountSchema = object().shape({
    string: positiveInteger.optional(),
    richText: positiveInteger.optional(),
    image: positiveInteger.optional(),
    audio: positiveInteger.optional(),
    video: positiveInteger.optional()
})

const post = {
    categoriesCount: positiveInteger.required(),
    nestedCategoriesCount: positiveInteger.required(),
    cardsPerCategoryCount: positiveInteger.required(),
    contentsPerCardSideCount: positiveInteger.required(),
    storageBytesCount: positiveInteger.required(),
    valuePerContentCount: valuePerContentCountSchema.required(),
}
export const usagePostSchema = object().shape(post).required()

const create = {
    userId: likeObjectId.required(),

    categoriesCount: positiveInteger.required(),
    nestedCategoriesCount: positiveInteger.required(),
    cardsPerCategoryCount: positiveInteger.required(),
    contentsPerCardSideCount: positiveInteger.required(),
    storageBytesCount: positiveInteger.required(),
    valuePerContentCount: valuePerContentCountSchema.required(),
}
export const usageCreateSchema = object().shape(create).required()

const update = {
    categoriesCount: positiveInteger.optional(),
    nestedCategoriesCount: positiveInteger.optional(),
    cardsPerCategoryCount: positiveInteger.optional(),
    contentsPerCardSideCount: positiveInteger.optional(),
    storageBytesCount: positiveInteger.optional(),
    valuePerContentCount: valuePerContentCountSchema.optional(),
}
export const usageUpdateSchema = object().shape(update).required()

export const usageSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: likeObjectId.required(),

    categoriesCount: positiveInteger.required(),
    nestedCategoriesCount: positiveInteger.required(),
    cardsPerCategoryCount: positiveInteger.required(),
    contentsPerCardSideCount: positiveInteger.required(),
    storageBytesCount: positiveInteger.required(),
    valuePerContentCount: valuePerContentCountSchema.required(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})

export type UsagePost = InferType<typeof usagePostSchema>
export type UsageCreate = InferType<typeof usageCreateSchema>
export type UsageUpdate = InferType<typeof usageUpdateSchema>
export type Usage = InferType<typeof usageSchema>

export type UsageField = Exclude<keyof Usage, 'valuePerContentCount' | 'createdAt' | 'updatedAt' | '_id' | 'userId' | 'schemaVersion'> | `valuePerContentCount.${keyof Usage['valuePerContentCount'] & string}`

export function resolveUsageField(quotaField: QuotaField): UsageField {
    return quotaField.replace('max', '')[0].toLowerCase() + quotaField.replace('max', '').slice(1) + 'Count' as any
}

export function resolveQuotaField(usageField: UsageField): QuotaField {
    return 'max' + usageField[0].toUpperCase() + usageField.replace('Count', '') as any
}
