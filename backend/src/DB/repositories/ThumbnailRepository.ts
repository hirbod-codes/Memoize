import { ClientSession, Collection, Db, GridFSBucket, GridFSBucketReadStream, GridFSBucketWriteStream, GridFSFile, ObjectId } from "mongodb";
import { MongoDB } from '../mongodb';
import { ThumbnailMetadata, thumbnailCollectionName as collectionName } from "../models/Files";
import { ISeedable } from '../ISeedable';
import { IDropable } from "../IDropable";
import { IRepository } from "../IRepository";
import { Readable } from "node:stream";

export class ThumbnailRepository implements IRepository, ISeedable, IDropable {
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
        ThumbnailRepository.bucket = new GridFSBucket(await MongoDB.getDb(), { bucketName: collectionName });
        ThumbnailRepository.filesCollection = (await MongoDB.getDb()).collection(`${collectionName}.files`);
        ThumbnailRepository.chunksCollection = (await MongoDB.getDb()).collection(`${collectionName}.chunks`);
    }

    async dropCollection(db: Db): Promise<void> {
        await db.dropCollection(collectionName + '.files')
        await db.dropCollection(collectionName + '.chunks')
    }

    async seed(count?: number): Promise<void> {
        // throw new Error("Method not implemented.");
    }

    private async getReadStream(fileId: string | ObjectId): Promise<GridFSBucketReadStream> {
        return ThumbnailRepository.bucket!.openDownloadStream(typeof fileId === 'string' ? ObjectId.createFromHexString(fileId) : fileId)
    }

    private async getWriteStream(fileName: string, metadata: ThumbnailMetadata): Promise<GridFSBucketWriteStream> {
        return ThumbnailRepository.bucket!.openUploadStream(fileName, { metadata })
    }

    async upload(metadata: ThumbnailMetadata, file: { fileName: string; bytes: Readable | Buffer | Uint8Array; contentType?: string }, temporary: boolean = true): Promise<string | false> {
        try {
            if (file.bytes instanceof Readable && file.bytes.pipe !== undefined)
                return await (() => new Promise<any>(async (res, rej) => {
                    const upload = await this.getWriteStream(file.fileName, metadata);

                    (file.bytes as Readable).pipe(upload)

                    upload.on('finish', (f) => {
                        res(f)
                    })

                    upload.on('error', (e) => {
                        rej(e)
                    });
                }))()
            else
                return await (() => new Promise<string>(async (res, rej) => {
                    const upload = await this.getWriteStream(file.fileName, metadata);
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

    async getFileByAudioId(audioId: string): Promise<GridFSFile | undefined> {
        try {
            return (await ThumbnailRepository.bucket!.find({ 'metadata.audioId': ObjectId.createFromHexString(audioId) }, { session: this.session }).toArray())[0];
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFilesByUserId(userId: string): Promise<GridFSFile | undefined> {
        try {
            return (await ThumbnailRepository.bucket!.find({ 'metadata.userId': ObjectId.createFromHexString(userId) }, { session: this.session }).toArray())[0];
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFile(fileId: string): Promise<GridFSFile | undefined> {
        try {
            return (await ThumbnailRepository.bucket!.find({ _id: ObjectId.createFromHexString(fileId) }, { session: this.session }).toArray())[0];
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    async getFiles(fileIds: string[]): Promise<GridFSFile[]> {
        try {
            return await ThumbnailRepository.bucket!.find({ _id: { $in: fileIds.map(id => ObjectId.createFromHexString(id)) } }, { session: this.session }).toArray();
        } catch (e) {
            console.error(e)
            return []
        }
    }

    async getFileByUserId(userId: string): Promise<GridFSFile | false> {
        try {
            return (await ThumbnailRepository.bucket!.find({ 'metadata.userId': ObjectId.createFromHexString(userId) }, { session: this.session }).toArray())[0];
        } catch (e) {
            console.error(e)
            return false
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
            return await ThumbnailRepository.filesCollection!.updateOne({ _id: ObjectId.createFromHexString(fileId) }, { 'metadata.temporary': false }, { session: this.session })
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async makePermanentByVideoId(videoId: string) {
        try {
            return await ThumbnailRepository.filesCollection!.updateOne({ 'metadata.videoId': ObjectId.createFromHexString(videoId) }, { 'metadata.temporary': false }, { session: this.session })
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async deleteFilesByUserId(userId: string): Promise<boolean> {
        try {
            const cursor = ThumbnailRepository.filesCollection!.find({ 'metadata.userId': userId }, { session: this.session })

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
            const cursor = ThumbnailRepository.filesCollection!.find({ 'metadata.videoId': videoId, 'metadata.userId': userId }, { session: this.session })

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
            const cursor = ThumbnailRepository.filesCollection!.find({ 'metadata.videoId': videoId }, { session: this.session })

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
            let r = await ThumbnailRepository.chunksCollection!.deleteMany({ files_id: { $in: fileIds.map(m => ObjectId.createFromHexString(m)) } }, { session: this.session })
            if (!r.acknowledged)
                return false

            r = await ThumbnailRepository.filesCollection!.deleteMany({ _id: { $in: fileIds.map(m => ObjectId.createFromHexString(m)) } }, { session: this.session })
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
            let r = await ThumbnailRepository.chunksCollection!.deleteMany({ files_id: ObjectId.createFromHexString(fileId) }, { session: this.session })
            if (!r.acknowledged)
                return false

            r = await ThumbnailRepository.filesCollection!.deleteMany({ _id: ObjectId.createFromHexString(fileId) }, { session: this.session })
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
            let r = await ThumbnailRepository.chunksCollection!.deleteMany({ 'metadata.temporary': true }, { session: this.session })
            if (!r.acknowledged)
                return false

            r = await ThumbnailRepository.filesCollection!.deleteMany({ 'metadata.temporary': true }, { session: this.session })
            if (!r.acknowledged)
                return false

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }
}
