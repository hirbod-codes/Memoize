import { number, string } from "yup";
import { object } from "yup";
import { paymentMethodSchema } from "../../DB/models/Subscription";

export const postSchema = object().required().shape({
    planTitle: string().required().label('Plan Title'),
    paymentMethod: paymentMethodSchema.required().strict(),
})

export const zibalVerifySchema = object().required().shape({
    subscriptionId: string().objectIdString().required().label('Subscription id'),
    success: string().required().label('Success'),
    trackId: string().label('Track id'),
    cardNumber: string().label('Card number'),
    hashedCardNumber: string().label('Hashed card number'),
})

export const zarinpalVerifySchema = object().required().shape({
    subscriptionId: string().objectIdString().required().label('Subscription id'),
    authority: string().required().label('Authority'),
})
export const zarinpalVerifyCheckSchema = object().required().shape({
    uuid: string().required().label('Uuid'),
})
