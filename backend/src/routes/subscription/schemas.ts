import { number, string } from "yup";
import { object } from "yup";
import { paymentMethodSchema } from "../../DB/models/Subscription";

export const postUpgradeSchema = object().required().shape({
    planTitle: string().optional().label('Plan Title'),
    paymentMethod: paymentMethodSchema.optional().strict(),
    subscriptionDueTSMS: number().integer().min(1).optional().label('Subscription due'),
    extraStorageBytes: number().integer().min(1).optional().label('Storage space'),
})

export const postSchema = object().required().shape({
    planTitle: string().required().label('Plan Title'),
    paymentMethod: paymentMethodSchema.required().strict(),
    subscriptionDueTSMS: number().integer().min(1).required().label('Subscription due'),
    extraStorageBytes: number().integer().min(1).default(0).label('Storage space'),
})

export const zibalVerifySchema = object().required().shape({
    subscriptionId: string().objectIdString().required().label('Subscription id'),
    success: string().required().label('Success'),
    status: string().label('Status'),
    trackId: string().label('Track id'),
})

export const zarinpalVerifySchema = object().required().shape({
    subscriptionId: string().objectIdString().required().label('Subscription id'),
    authority: string().required().label('Authority'),
})
export const zarinpalVerifyCheckSchema = object().required().shape({
    uuid: string().required().label('Uuid'),
})
