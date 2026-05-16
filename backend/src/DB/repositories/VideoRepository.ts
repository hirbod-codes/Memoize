import { ClientSession, Collection, Db, GridFSBucket, GridFSBucketReadStream, GridFSBucketWriteStream, GridFSFile, ObjectId } from "mongodb";
import { MongoDB } from '../mongodb';
import { videoCollectionName as collectionName, VideoMetadata } from "../models/Files";
import { ISeedable } from '../ISeedable';
import { IDropable } from "../IDropable";
import { IRepository } from "../IRepository";

export class VideoRepository implements IRepository, ISeedable, IDropable {
    IDropable: 'IDropable' = 'IDropable';
    IRepository: 'IRepository' = 'IRepository';
    ISeedable: 'ISeedable' = 'ISeedable';

    private session: ClientSession | undefined = undefined
    private static bucket: GridFSBucket | undefined = undefined
    private static filesCollection: Collection<any> | undefined = undefined
    private static chunksCollection: Collection<any> | undefined = undefined

    setTransactionSession(session?: ClientSession): void {
        this.session = session
    }

    unsetTransactionSession(): void {
        this.session = undefined
    }

    async addCollection(db: Db): Promise<void> {
        VideoRepository.bucket = new GridFSBucket(await MongoDB.getDb(), { bucketName: collectionName });
        VideoRepository.filesCollection = (await MongoDB.getDb()).collection(`${collectionName}.files`);
        VideoRepository.chunksCollection = (await MongoDB.getDb()).collection(`${collectionName}.chunks`);
    }

    async dropCollection(db: Db): Promise<void> {
        await db.dropCollection(collectionName + '.files')
        await db.dropCollection(collectionName + '.chunks')
    }

    async seed(count?: number): Promise<void> {
        // throw new Error("Method not implemented.");
    }

    private async getReadStream(fileId: string | ObjectId): Promise<GridFSBucketReadStream> {
        return VideoRepository.bucket!.openDownloadStream(typeof fileId === 'string' ? ObjectId.createFromHexString(fileId) : fileId)
    }

    private async getWriteStream(fileName: string, metadata: VideoMetadata): Promise<GridFSBucketWriteStream> {
        return VideoRepository.bucket!.openUploadStream(fileName, { metadata })
    }

    async uploadFile(metadata: VideoMetadata, file: { fileName: string; bytes: Buffer | Uint8Array; contentType?: string }, temporary: boolean = true): Promise<string | undefined> {
        const result = await (() => new Promise<string | undefined>(async (res, rej) => {
            const upload = await this.getWriteStream(file.fileName, metadata)
            upload
                .on('close', () => { res(upload.id.toString()) })
                .write(file.bytes, (e) => {
                    if (e) {
                        console.error(e)
                        res(undefined)
                    } else
                        upload.end()
                })
        }))()

        return result
    }

    async getFile(fileId: string): Promise<GridFSFile | undefined> {
        try {
            return (await VideoRepository.bucket!.find({ _id: ObjectId.createFromHexString(fileId) }, { session: this.session }).toArray())[0];
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFiles(fileIds: string[]): Promise<GridFSFile[]> {
        try {
            return await VideoRepository.bucket!.find({ _id: { $in: fileIds.map(id => ObjectId.createFromHexString(id)) } }, { session: this.session }).toArray();
        } catch (e) {
            console.error(e)
            return []
        }
    }

    async getFileByTermId(termId: string): Promise<GridFSFile | undefined> {
        try {
            return (await VideoRepository.bucket!.find({ 'metadata.leafTermId': ObjectId.createFromHexString(termId) }, { session: this.session }).toArray())[0];
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFilesByTermId(termIds: string[]): Promise<GridFSFile[]> {
        try {
            return await VideoRepository.bucket!.find({ 'metadata.leafTermId': { $in: termIds.map(id => ObjectId.createFromHexString(id)) } }, { session: this.session }).toArray();
        } catch (e) {
            console.error(e)
            return []
        }
    }

    async getFileByDefinitionId(definitionId: string): Promise<GridFSFile | undefined> {
        try {
            const results = await VideoRepository.bucket!.find({ 'metadata.leafDefinitionId': ObjectId.createFromHexString(definitionId) }, { session: this.session }).toArray()
            return results.length > 0 ? results[0] : undefined;
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFilesByDefinitionId(definitionIds: string[]): Promise<GridFSFile[]> {
        try {
            return await VideoRepository.bucket!.find({ 'metadata.leafDefinitionId': { $in: definitionIds.map(id => ObjectId.createFromHexString(id)) } }, { session: this.session }).toArray();
        } catch (e) {
            console.error(e)
            return []
        }
    }

    async getFileByUserId(userId: string): Promise<GridFSFile | undefined> {
        try {
            const results = await VideoRepository.bucket!.find({ 'metadata.userId': ObjectId.createFromHexString(userId) }, { session: this.session }).toArray()
            return results.length > 0 ? results[0] : undefined;
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFilesByUserId(userIds: string[]): Promise<GridFSFile[]> {
        try {
            return await VideoRepository.bucket!.find({ 'metadata.userId': { $in: userIds.map(id => ObjectId.createFromHexString(id)) } }, { session: this.session }).toArray();
        } catch (e) {
            console.error(e)
            return []
        }
    }

    async downloadFile(writeStream: NodeJS.WritableStream, fileId: string): Promise<boolean> {
        console.log('downloading file...');

        return new Promise<boolean>(async (resolve, reject) => {
            const readStream = await this.getReadStream(fileId)

            readStream
                .on('close', async () => {
                    console.log('on close')
                    console.log('exiting...')
                    resolve(true)
                })
                .on('error', e => { console.error(e); resolve(false) })
                .pipe(writeStream, { end: true })
        })
    }

    async makePermanent(fileId: string) {
        try {
            return await VideoRepository.filesCollection!.updateOne({ _id: ObjectId.createFromHexString(fileId) }, { 'metadata.temporary': false }, { session: this.session })
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async deleteFilesByUserId(userId: string) {
        try {
            let files = await VideoRepository.filesCollection!.find({ 'metadata.userId': typeof userId === 'string' ? ObjectId.createFromHexString(userId) : userId }, { session: this.session }).toArray()
            if (files.length === 0)
                return true

            for (const file of files)
                if (!await this.deleteFile(file._id.toString()))
                    return false

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }

    async deleteFilesByTermId(termId: string): Promise<boolean> {
        try {
            let files = await VideoRepository.filesCollection!.find({ 'metadata.leafTermId': typeof termId === 'string' ? ObjectId.createFromHexString(termId) : termId }, { session: this.session }).toArray()
            if (files.length === 0)
                return true

            for (const file of files)
                if (!await this.deleteFile(file._id.toString()))
                    return false

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }

    async deleteFilesByDefinition(definition: string): Promise<boolean> {
        try {
            let files = await VideoRepository.filesCollection!.find({ 'metadata.leafDefinition': typeof definition === 'string' ? ObjectId.createFromHexString(definition) : definition }, { session: this.session }).toArray()
            if (files.length === 0)
                return true

            for (const file of files)
                if (!await this.deleteFile(file._id.toString()))
                    return false

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }

    async deleteFiles(fileIds: string[]): Promise<boolean> {
        try {
            let r = await VideoRepository.chunksCollection!.deleteMany({ files_id: { $in: fileIds.map(m => ObjectId.createFromHexString(m)) } }, { session: this.session })
            if (!r.acknowledged)
                return false

            r = await VideoRepository.filesCollection!.deleteMany({ _id: { $in: fileIds.map(m => ObjectId.createFromHexString(m)) } }, { session: this.session })
            if (!r.acknowledged)
                return false

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }

    async deleteFile(fileId: string): Promise<boolean> {
        try {
            let r = await VideoRepository.chunksCollection!.deleteMany({ files_id: ObjectId.createFromHexString(fileId) }, { session: this.session })
            if (!r.acknowledged)
                return false

            r = await VideoRepository.filesCollection!.deleteMany({ _id: ObjectId.createFromHexString(fileId) }, { session: this.session })
            if (!r.acknowledged)
                return false

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }
}
