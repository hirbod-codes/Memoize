import { InferType, number, object, string } from 'yup';
import { likeObjectId, priceSchema } from '../common_schemas';

export const collectionName = 'subscription'

export const schemaVersion = 'v1.0.0'

const statusSchema = string().oneOf(['active', 'canceled', 'trialing', 'paymentNotVerified', 'paymentNotCompleted', 'inDebtToUser'])
const processorSubscriptionIdSchema = string().when('status', { is: 'paymentNotVerified', then(s) { return s.optional() }, otherwise(s) { return s.required() } })

export type PaymentMethod = "zarinpal" | "paypal" | "bitcoin"

export const paymentMethodSchema = string().oneOf<PaymentMethod>(['zarinpal', 'paypal', 'bitcoin'])

const create = {
    userId: string().required(),

    planTitle: string().required().label('Plan title'),

    status: statusSchema.required(),

    currentPeriodEnd: number().required(),

    price: priceSchema.required(),

    paymentMethod: paymentMethodSchema.required(),

    processorSubscriptionId: processorSubscriptionIdSchema
}
export const subscriptionCreateSchema = object().shape(create).required()


const update = {
    schemaVersion: string().optional().min(6).max(20),

    status: statusSchema.optional(),

    currentPeriodEnd: number().optional(),

    processorSubscriptionId: string().optional(),

    paymentAuthority: string().optional(),

    completedAt: number().integer().min(0).optional(),

    verifiedAt: number().integer().min(0).optional(),

    refId: string().optional(),
    cardNumber: string().optional(),
    cardNumberHash: string().optional(),
}
export const subscriptionUpdateSchema = object().shape(update).required()

export const subscriptionSchema = object().shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    userId: string().required(),

    planTitle: string().required().label('Plan title'),

    status: statusSchema.required(),

    currentPeriodEnd: number().required(),

    processorSubscriptionId: processorSubscriptionIdSchema,

    price: priceSchema.required(),

    paymentMethod: paymentMethodSchema.required(),

    paymentAuthority: string().optional(),

    completedAt: number().integer().min(0).optional(),

    verifiedAt: number().integer().min(0).optional(),

    refId: string().optional(),
    cardNumber: string().optional(),
    cardNumberHash: string().optional(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})

export type SubscriptionCreate = InferType<typeof subscriptionCreateSchema>
export type SubscriptionUpdate = InferType<typeof subscriptionUpdateSchema>
export type Subscription = InferType<typeof subscriptionSchema>
