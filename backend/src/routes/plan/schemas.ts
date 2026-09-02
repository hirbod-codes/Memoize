import { string } from "yup";
import { object } from "yup";
import { paymentMethodSchema } from "../../DB/models/Subscription";

export const postSchema = object().required().shape({
    planTitle: string().required().label('Plan Title'),
    paymentMethod: paymentMethodSchema.required().strict(),
})

export const verifySchema = object().required().shape({
    subscriptionId: string().required().label('Subscription id'),
    authority: string().required().label('Authority'),
})
