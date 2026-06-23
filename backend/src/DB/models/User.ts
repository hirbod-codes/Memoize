import { InferType, number, object, string } from "yup";
import { likeObjectId } from "../common_schemas";

export const collectionName = 'user'

export const schemaVersion = 'v1.0.0'

export const userSchema = object().required().stripUnknown().strict(true).shape({
    schemaVersion: string().optional().min(6).max(20),
    _id: likeObjectId.optional(),
    role: string().required(),
    username: string().optional(),
    phoneNumber: string().optional().matches(/^09[0-9]{9}$/),
    email: string().optional().email(),
    avatarKey: string().optional(),
    password: string().required(),
    refreshToken: string().optional(),
    createdAt: number().optional(),
    updatedAt: number().optional(),
})

export type User = InferType<typeof userSchema>