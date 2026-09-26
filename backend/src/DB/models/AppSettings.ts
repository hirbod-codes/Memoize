import { boolean, InferType, number, object, string } from "yup";
import { priceSchema } from "./Plan";

export const collectionName = 'appSettings'

export const schemaVersion = 'v1.0.0'

const update = {
    schemaVersion: string().optional().min(6).max(20),

    allowEmailRegistration: boolean().optional(),
    allowOtp: boolean().optional(),
}
export const appSettingsUpdateSchema = object().shape(update).required()

export type AppSettingsKey = "auth" | "pricing"

export const appSettingsSchema = object().required().stripUnknown().strict(true).shape({
    schemaVersion: string().optional().min(6).max(20),

    // discriminates which settings group this document holds, e.g. 'auth'.
    // one document per group rather than a single blob, so each group can
    // grow its own typed fields the same way User.ts does.
    key: string().required().oneOf<AppSettingsKey>(['auth', 'pricing']),

    allowEmailRegistration: boolean().when('key', { is: 'auth', then(s) { return s.required() } }),
    allowOtp: boolean().when('key', { is: 'auth', then(s) { return s.required() } }),

    pricePerGbPerMonth: priceSchema.when('key', { is: 'pricing', then(s) { return s.required() } }),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})

export type AppSettings = InferType<typeof appSettingsSchema>
export type AppSettingsUpdate = InferType<typeof appSettingsUpdateSchema>
