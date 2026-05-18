import { ClientSession, Collection, Db, GridFSBucket, GridFSBucketReadStream, GridFSBucketWriteStream, GridFSFile, ObjectId } from "mongodb";
import { MongoDB } from '../mongodb';
import { audioCollectionName as collectionName, AudioMetadata } from "../models/Files";
import { ISeedable } from '../ISeedable';
import { IDropable } from "../IDropable";
import { IRepository } from "../IRepository";

export class AudioFileRepository implements IRepository, ISeedable, IDropable {
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
        AudioFileRepository.bucket = new GridFSBucket(await MongoDB.getDb(), { bucketName: collectionName });
        AudioFileRepository.filesCollection = (await MongoDB.getDb()).collection(`${collectionName}.files`);
        AudioFileRepository.chunksCollection = (await MongoDB.getDb()).collection(`${collectionName}.chunks`);
    }

    async dropCollection(db: Db): Promise<void> {
        await db.dropCollection(collectionName + '.files')
        await db.dropCollection(collectionName + '.chunks')
    }

    async seed(count?: number): Promise<void> {
        // throw new Error("Method not implemented.");
    }

    private async getReadStream(fileId: string | ObjectId, range?: number[] | undefined): Promise<GridFSBucketReadStream> {
        return AudioFileRepository.bucket!.openDownloadStream(typeof fileId === 'string' ? ObjectId.createFromHexString(fileId) : fileId, !range ? undefined : { start: range[0], end: range[1] + 1 })
    }

    private async getWriteStream(fileName: string, metadata: AudioMetadata): Promise<GridFSBucketWriteStream> {
        return AudioFileRepository.bucket!.openUploadStream(fileName, { metadata })
    }

    async upload(metadata: AudioMetadata, file: { fileName: string; bytes: Buffer | Uint8Array; }): Promise<string | false> {
        try {
            return await (() => new Promise<string>(async (res, rej) => {
                const upload = await this.getWriteStream(file.fileName, metadata)
                upload
                    .on('close', () => { res(upload.id.toString()) })
                    .write(file.bytes, (e) => {
                        if (e) {
                            console.error(e)
                            rej(e)
                        } else
                            upload.end()
                    })
            }))()
        } catch (error) {
            console.error(error);
            return false
        }
    }

    async getFile(fileId: string): Promise<GridFSFile | undefined> {
        try {
            return (await AudioFileRepository.bucket!.find({ _id: ObjectId.createFromHexString(fileId) }, { session: this.session }).toArray())[0];
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFiles(fileIds: string[]): Promise<GridFSFile[]> {
        try {
            return await AudioFileRepository.bucket!.find({ _id: { $in: fileIds.map(id => ObjectId.createFromHexString(id)) } }, { session: this.session }).toArray();
        } catch (e) {
            console.error(e)
            return []
        }
    }

    async getFileByUserId(userId: string): Promise<GridFSFile | undefined> {
        try {
            const results = await AudioFileRepository.bucket!.find({ 'metadata.userId': ObjectId.createFromHexString(userId) }, { session: this.session }).toArray()
            return results.length > 0 ? results[0] : undefined;
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFileByTitle(title: string): Promise<GridFSFile | undefined> {
        try {
            const results = await AudioFileRepository.bucket!.find({ 'metadata.title': title }, { session: this.session }).toArray()
            return results.length > 0 ? results[0] : undefined;
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFilesByUserId(userIds: string[]): Promise<GridFSFile[]> {
        try {
            return await AudioFileRepository.bucket!.find({ 'metadata.userId': { $in: userIds.map(id => ObjectId.createFromHexString(id)) } }, { session: this.session }).toArray();
        } catch (e) {
            console.error(e)
            return []
        }
    }

    async downloadFile(writeStream: NodeJS.WritableStream, fileId: string, range?: number[] | undefined): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const readStream = await this.getReadStream(fileId, range)

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
            return await AudioFileRepository.filesCollection!.updateOne({ _id: ObjectId.createFromHexString(fileId) }, { 'metadata.temporary': false }, { session: this.session })
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async makePermanentByAudioId(audioId: string) {
        try {
            return await AudioFileRepository.filesCollection!.updateOne({ 'metadata.audioId': ObjectId.createFromHexString(audioId) }, { 'metadata.temporary': false }, { session: this.session })
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async deleteFilesByUserId(userId: string) {
        try {
            let files = await AudioFileRepository.filesCollection!.find({ 'metadata.userId': typeof userId === 'string' ? ObjectId.createFromHexString(userId) : userId }, { session: this.session }).toArray()
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
            let r = await AudioFileRepository.chunksCollection!.deleteMany({ files_id: { $in: fileIds.map(m => ObjectId.createFromHexString(m)) } }, { session: this.session })
            if (!r.acknowledged)
                return false

            r = await AudioFileRepository.filesCollection!.deleteMany({ _id: { $in: fileIds.map(m => ObjectId.createFromHexString(m)) } }, { session: this.session })
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
            let r = await AudioFileRepository.chunksCollection!.deleteMany({ files_id: ObjectId.createFromHexString(fileId) }, { session: this.session })
            if (!r.acknowledged)
                return false

            r = await AudioFileRepository.filesCollection!.deleteMany({ _id: ObjectId.createFromHexString(fileId) }, { session: this.session })
            if (!r.acknowledged)
                return false

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }

    async deleteTemporaryFiles(): Promise<boolean> {
        try {
            let r = await AudioFileRepository.chunksCollection!.deleteMany({ 'metadata.temporary': true }, { session: this.session })
            if (!r.acknowledged)
                return false

            r = await AudioFileRepository.filesCollection!.deleteMany({ 'metadata.temporary': true }, { session: this.session })
            if (!r.acknowledged)
                return false

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }
}
