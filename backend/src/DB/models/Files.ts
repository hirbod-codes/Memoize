import { ObjectId } from 'mongodb';

export const avatarCollectionName = "avatarFile"
export type AvatarMetadata = {
    userId: ObjectId

    temporary: boolean

    contentType?: string
}

export const imageCollectionName = "imageFile"
export type ImageMetadata = {
    userId: ObjectId

    leafTermId?: ObjectId
    leafDefinitionId?: ObjectId

    temporary: boolean

    contentType?: string
}

export const videoCollectionName = "videoFile"
export type VideoMetadata = {
    userId: ObjectId

    leafTermId?: ObjectId
    leafDefinitionId?: ObjectId

    temporary: boolean

    contentType?: string
}

export const audioCollectionName = "audioFile"
export type AudioMetadata = {
    userId: ObjectId

    leafTermId?: ObjectId
    leafDefinitionId?: ObjectId

    temporary: boolean

    contentType?: string
}