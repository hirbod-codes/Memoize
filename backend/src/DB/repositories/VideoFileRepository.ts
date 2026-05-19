import { AnyBulkWriteOperation, ClientSession, Collection, Db, GridFSBucket, GridFSBucketReadStream, GridFSBucketWriteStream, GridFSFile, ObjectId } from "mongodb";
import { MongoDB } from '../mongodb';
import { videoCollectionName as collectionName, VideoMetadata } from "../models/Files";
import { ISeedable } from '../ISeedable';
import { IDropable } from "../IDropable";
import { IRepository } from "../IRepository";
import { ReadStream } from "fs";
import { pipeline } from "stream";

export class VideoFileRepository implements IRepository, ISeedable, IDropable {
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
        VideoFileRepository.bucket = new GridFSBucket(await MongoDB.getDb(), { bucketName: collectionName });
        VideoFileRepository.filesCollection = (await MongoDB.getDb()).collection(`${collectionName}.files`);
        VideoFileRepository.chunksCollection = (await MongoDB.getDb()).collection(`${collectionName}.chunks`);
    }

    async dropCollection(db: Db): Promise<void> {
        await db.dropCollection(collectionName + '.files')
        await db.dropCollection(collectionName + '.chunks')
    }

    async seed(count?: number): Promise<void> {
        // throw new Error("Method not implemented.");
    }

    private async getReadStream(fileId: string | ObjectId, range: number[] | undefined): Promise<GridFSBucketReadStream> {
        return VideoFileRepository.bucket!.openDownloadStream(typeof fileId === 'string' ? ObjectId.createFromHexString(fileId) : fileId, !range ? undefined : { start: range[0], end: range[1] + 1 })
    }

    private async getWriteStream(fileName: string, metadata: VideoMetadata): Promise<GridFSBucketWriteStream> {
        return VideoFileRepository.bucket!.openUploadStream(fileName, { metadata, chunkSizeBytes: 1024 * 1024 })
    }

    async upload(metadata: VideoMetadata, file: { fileName: string; bytes: Buffer | Uint8Array | ReadStream; }): Promise<string | false> {
        try {
            return await (() => new Promise<string>(async (res, rej) => {
                const upload = await this.getWriteStream(file.fileName, metadata)
                if (file.bytes instanceof ReadStream)
                    pipeline<ReadStream, GridFSBucketWriteStream>(file.bytes, upload, (e) => { if (e) rej(e); else res(upload.id.toString()) })
                else
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
            return (await VideoFileRepository.bucket!.find({ _id: ObjectId.createFromHexString(fileId) }, { session: this.session }).toArray())[0];
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFileByVideoId(videoId: string, fileName: string): Promise<GridFSFile | undefined> {
        try {
            return (await VideoFileRepository.bucket!.find({ 'metadata.videoId': videoId, filename: fileName }, { session: this.session }).toArray())[0];
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFiles(fileIds: string[]): Promise<GridFSFile[]> {
        try {
            return await VideoFileRepository.bucket!.find({ _id: { $in: fileIds.map(id => ObjectId.createFromHexString(id)) } }, { session: this.session }).toArray();
        } catch (e) {
            console.error(e)
            return []
        }
    }

    async getFileByTermId(termId: string): Promise<GridFSFile | undefined> {
        try {
            return (await VideoFileRepository.bucket!.find({ 'metadata.leafTermId': termId }, { session: this.session }).toArray())[0];
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFilesByTermId(termIds: string[]): Promise<GridFSFile[]> {
        try {
            return await VideoFileRepository.bucket!.find({ 'metadata.leafTermId': { $in: termIds } }, { session: this.session }).toArray();
        } catch (e) {
            console.error(e)
            return []
        }
    }

    async getFileByDefinitionId(definitionId: string): Promise<GridFSFile | undefined> {
        try {
            const results = await VideoFileRepository.bucket!.find({ 'metadata.leafDefinitionId': definitionId }, { session: this.session }).toArray()
            return results.length > 0 ? results[0] : undefined;
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFilesByDefinitionId(definitionIds: string[]): Promise<GridFSFile[]> {
        try {
            return await VideoFileRepository.bucket!.find({ 'metadata.leafDefinitionId': { $in: definitionIds } }, { session: this.session }).toArray();
        } catch (e) {
            console.error(e)
            return []
        }
    }

    async getFileByUserId(userId: string): Promise<GridFSFile | undefined> {
        try {
            const results = await VideoFileRepository.bucket!.find({ 'metadata.userId': userId }, { session: this.session }).toArray()
            return results.length > 0 ? results[0] : undefined;
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFilesByUserId(userIds: string[]): Promise<GridFSFile[]> {
        try {
            return await VideoFileRepository.bucket!.find({ 'metadata.userId': { $in: userIds } }, { session: this.session }).toArray();
        } catch (e) {
            console.error(e)
            return []
        }
    }

    async downloadFile(writeStream: NodeJS.WritableStream, fileId: string, range?: number[] | undefined): Promise<boolean> {
        console.log('downloading file...');

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

    async makePermanentByVideoId(videoId: string) {
        try {
            return await VideoFileRepository.filesCollection!.updateOne({ 'metadata.videoId': ObjectId.createFromHexString(videoId) }, { 'metadata.temporary': false }, { session: this.session })
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async makePermanent(fileId: string) {
        try {
            return await VideoFileRepository.filesCollection!.updateOne({ _id: ObjectId.createFromHexString(fileId) }, { $set: { 'metadata.temporary': false } }, { session: this.session })
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async makePermanentBulk(fileIds: string[]) {
        try {
            const bulkWrites = fileIds.map(id => ({
                updateOne: {
                    filter: { _id: ObjectId.createFromHexString(id) },
                    update: { $set: { 'metadata.temporary': false } }
                }
            }))

            return await VideoFileRepository.filesCollection!.bulkWrite(bulkWrites, { session: this.session })
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async deleteFilesByUserId(userId: string): Promise<boolean> {
        try {
            const cursor = VideoFileRepository.filesCollection!.find({ 'metadata.userId': userId }, { session: this.session })

            for await (const c of cursor)
                if (!await this.deleteFile(c._id.toString()))
                    return false

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }

    async deleteFileByVideoId(videoId: string): Promise<boolean> {
        try {
            const cursor = VideoFileRepository.filesCollection!.find({ 'metadata.videoId': ObjectId.createFromHexString(videoId) }, { session: this.session })

            for await (const c of cursor)
                if (!await this.deleteFile(c._id.toString()))
                    return false

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }

    async deleteFileForUserByVideoId(videoId: string, userId: string): Promise<boolean> {
        try {
            const cursor = VideoFileRepository.filesCollection!.find({ 'metadata.videoId': ObjectId.createFromHexString(videoId), 'metadata.userId': userId }, { session: this.session })

            for await (const c of cursor)
                if (!await this.deleteFile(c._id.toString()))
                    return false

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }

    async deleteFiles(fileIds: string[]): Promise<boolean> {
        try {
            let r = await VideoFileRepository.chunksCollection!.deleteMany({ files_id: { $in: fileIds.map(m => ObjectId.createFromHexString(m)) } }, { session: this.session })
            if (!r.acknowledged)
                return false

            r = await VideoFileRepository.filesCollection!.deleteMany({ _id: { $in: fileIds.map(m => ObjectId.createFromHexString(m)) } }, { session: this.session })
            if (!r.acknowledged)
                return false

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }

    async deleteFileBulk(fileIds: string[]) {
        try {
            const chunksBulkWrites: AnyBulkWriteOperation<any>[] = fileIds.map(id => ({
                deleteMany: {
                    filter: { files_id: ObjectId.createFromHexString(id) },
                }
            }))
            const filesBulkWrites: AnyBulkWriteOperation<any>[] = fileIds.map(id => ({
                deleteMany: {
                    filter: { _id: ObjectId.createFromHexString(id) },
                }
            }))

            let r = await VideoFileRepository.chunksCollection!.bulkWrite(chunksBulkWrites, { session: this.session })
            if (!r.ok)
                return false

            r = await VideoFileRepository.filesCollection!.bulkWrite(filesBulkWrites, { session: this.session })
            if (!r.ok)
                return false

            return true
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async deleteFile(fileId: string): Promise<boolean> {
        try {
            let r = await VideoFileRepository.chunksCollection!.deleteMany({ files_id: ObjectId.createFromHexString(fileId) }, { session: this.session })
            if (!r.acknowledged)
                return false

            r = await VideoFileRepository.filesCollection!.deleteMany({ _id: ObjectId.createFromHexString(fileId) }, { session: this.session })
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
            let r = await VideoFileRepository.chunksCollection!.deleteMany({ 'metadata.temporary': true }, { session: this.session })
            if (!r.acknowledged)
                return false

            r = await VideoFileRepository.filesCollection!.deleteMany({ 'metadata.temporary': true }, { session: this.session })
            if (!r.acknowledged)
                return false

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }
}
