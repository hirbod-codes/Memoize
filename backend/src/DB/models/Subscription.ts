import { InferType, number, object, string } from 'yup';
import { likeObjectId } from '../common_schemas';

export const collectionName = 'subscription'

export const schemaVersion = 'v1.0.0'

const statusSchema = string().oneOf(['active', 'canceled', 'trialing'])

const post = {
    planTitle: string().required().label('Plan title'),

    currentPeriodEnd: number().required(),

    processorSubscriptionId: string().required(),
}
export const subscriptionPostSchema = object().shape(post).required()

const create = {
    userId: likeObjectId.required(),

    planTitle: string().required().label('Plan title'),

    status: statusSchema.required(),

    currentPeriodEnd: number().required(),

    processorSubscriptionId: string().required(),
}
export const subscriptionCreateSchema = object().shape(create).required()


const update = {
    schemaVersion: string().optional().min(6).max(20),

    status: statusSchema.optional(),

    currentPeriodEnd: number().optional(),

    processorSubscriptionId: string().optional(),
}
export const subscriptionUpdateSchema = object().shape(update).required()

export const subscriptionSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: likeObjectId.required(),

    planTitle: string().required().label('Plan title'),

    status: statusSchema.required(),

    currentPeriodEnd: number().required(),

    processorSubscriptionId: string().required(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})

export type SubscriptionPost = InferType<typeof subscriptionPostSchema>
export type SubscriptionCreate = InferType<typeof subscriptionCreateSchema>
export type SubscriptionUpdate = InferType<typeof subscriptionUpdateSchema>
export type Subscription = InferType<typeof subscriptionSchema>
