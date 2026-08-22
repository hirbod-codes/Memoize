import { boolean, InferType, number, object, string } from "yup";
import { likeObjectId } from "../common_schemas";

export const collectionName = 'appSettings'

export const schemaVersion = 'v1.0.0'

const update = {
    schemaVersion: string().optional().min(6).max(20),
    key: string().optional(),

    allowEmailRegistration: boolean().optional(),
    allowPhoneRegistration: boolean().optional(),
}
export const appSettingsUpdateSchema = object().shape(update).required()

export const appSettingsSchema = object().required().stripUnknown().strict(true).shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),

    // discriminates which settings group this document holds, e.g. 'auth'.
    // one document per group rather than a single blob, so each group can
    // grow its own typed fields the same way User.ts does.
    key: string().required(),

    allowEmailRegistration: boolean().optional(),
    allowPhoneRegistration: boolean().optional(),

    createdAt: number().optional(),
    updatedAt: number().optional(),
})

export type AppSettings = InferType<typeof appSettingsSchema>
export type AppSettingsUpdate = InferType<typeof appSettingsUpdateSchema>
