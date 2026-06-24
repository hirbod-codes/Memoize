import { AnyBulkWriteOperation, BulkWriteResult, ClientSession, Collection, Db, DeleteResult, InsertOneResult, ObjectId } from 'mongodb';
import { IDropable } from '../IDropable';
import { IRepository } from '../IRepository';
import { ISeedable } from '../ISeedable';
import { MongoDB } from '../mongodb';
import { collectionName, Video, VideoUpdate } from '../models/Video';

class VideoRepository implements IRepository, ISeedable, IDropable {
    IRepository: 'IRepository' = 'IRepository';
    ISeedable: 'ISeedable' = 'ISeedable';
    IDropable: 'IDropable' = 'IDropable';

    private session: ClientSession | undefined = undefined
    private static collection: Collection<Video> | undefined = undefined

    seed(count?: number): Promise<void> {
        throw new Error('Method not implemented.');
    }

    setTransactionSession(session?: ClientSession): void {
        this.session = session
    }

    unsetTransactionSession(): void {
        this.session = undefined
    }

    async addCollection(db: Db): Promise<void> {
        if (!(await db.listCollections().toArray()).map(e => e.name).includes(collectionName))
            await db.createCollection(collectionName)

        const indexes = await db.collection(collectionName).indexes()

        if (indexes.find(i => i.name === 'title') === undefined)
            await db.createIndex(collectionName, { title: 1, userId: 1 }, { unique: true, name: 'title' })

        if (indexes.find(i => i.name === 'userId') === undefined)
            await db.createIndex(collectionName, { userId: 1 }, { name: 'userId' })

        if (indexes.find(i => i.name === 'createdAt') === undefined)
            await db.createIndex(collectionName, { createdAt: -1 }, { name: 'createdAt' })

        if (indexes.find(i => i.name === 'updatedAt') === undefined)
            await db.createIndex(collectionName, { updatedAt: -1 }, { name: 'updatedAt' })

        VideoRepository.collection = (await MongoDB.getDb()).collection<Video>(collectionName)
    }

    async dropCollection(db: Db): Promise<void> {
        await db.dropCollection(collectionName)
    }

    async insert(video: Video): Promise<InsertOneResult> {
        return await VideoRepository.collection!.insertOne({ ...video, updatedAt: Date.now(), createdAt: Date.now() }, { session: this.session })
    }

    async get(id: string): Promise<Video> {
        return (await VideoRepository.collection!.find({ _id: ObjectId.createFromHexString(id) }, { session: this.session }).toArray())[0]
    }

    async getForUser(videoId: string, userId: string): Promise<Video> {
        return (await VideoRepository.collection!.find({ _id: ObjectId.createFromHexString(videoId), userId }, { session: this.session }).toArray())[0]
    }

    async getForUserByTitle(title: string, userId: string) {
        return (await VideoRepository.collection!.find({ title, userId }, { session: this.session }).toArray())[0]
    }

    async getManyForUser(leafIds: string[], userId: string): Promise<Video[]> {
        return await VideoRepository.collection!.find({ _id: { $in: leafIds.map(m => ObjectId.createFromHexString(m)) }, userId }, { session: this.session }).toArray()
    }

    async getByUserId(userId: string) {
        return await VideoRepository.collection!.find({ userId }, { session: this.session }).toArray()
    }

    getFromCursor(fromTsMs: number) {
        return VideoRepository.collection!.find({ updatedAt: { $gte: fromTsMs } })
    }

    async updateTitle(videoId: string, title: string) {
        return await VideoRepository.collection!.updateOne({ _id: ObjectId.createFromHexString(videoId) }, { $set: { title, updatedAt: Date.now() } }, { session: this.session })
    }

    async unsafeUpdate(audioId: string, userId: string, updates: VideoUpdate) {
        return await VideoRepository.collection!.updateOne({ _id: ObjectId.createFromHexString(audioId), userId }, { $set: { ...updates, updatedAt: Date.now() } }, { session: this.session })
    }

    async delete(id: string): Promise<DeleteResult> {
        return await VideoRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id) }, { session: this.session })
    }

    async deleteBulk(ids: string[]): Promise<BulkWriteResult> {
        const bulkWrites: AnyBulkWriteOperation<any>[] = ids.map(id => ({ deleteOne: { filter: { _id: ObjectId.createFromHexString(id) } } }))
        return await VideoRepository.collection!.bulkWrite(bulkWrites, { session: this.session })
    }

    async deleteForUser(id: string, userId: string): Promise<DeleteResult> {
        return await VideoRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id), userId }, { session: this.session })
    }

    async deleteTemporaries(): Promise<DeleteResult> {
        return await VideoRepository.collection!.deleteMany({ temporary: true }, { session: this.session })
    }
}

export default VideoRepository;