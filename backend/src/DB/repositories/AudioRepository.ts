import { AnyBulkWriteOperation, BulkWriteResult, ClientSession, Collection, Db, DeleteResult, InsertOneResult, ObjectId } from 'mongodb';
import { IDropable } from '../IDropable';
import { IRepository } from '../IRepository';
import { ISeedable } from '../ISeedable';
import { MongoDB } from '../mongodb';
import { collectionName, Audio, AudioCreate, AudioPatch, AudioUpdate } from '../models/Audio';

class AudioRepository implements IRepository, ISeedable, IDropable {
    IRepository: 'IRepository' = 'IRepository';
    ISeedable: 'ISeedable' = 'ISeedable';
    IDropable: 'IDropable' = 'IDropable';

    private session: ClientSession | undefined = undefined
    private static collection: Collection<Audio> | undefined = undefined

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

        AudioRepository.collection = (await MongoDB.getDb()).collection<Audio>(collectionName)
    }

    async dropCollection(db: Db): Promise<void> {
        await db.dropCollection(collectionName)
    }

    async insert(audio: AudioCreate): Promise<InsertOneResult> {
        return await AudioRepository.collection!.insertOne({ ...audio, updatedAt: Date.now(), createdAt: Date.now() }, { session: this.session })
    }

    async get(id: string): Promise<Audio> {
        return (await AudioRepository.collection!.find({ _id: ObjectId.createFromHexString(id) }, { session: this.session }).toArray())[0]
    }

    async getForUser(audioId: string, userId: string): Promise<Audio> {
        return (await AudioRepository.collection!.find({ _id: ObjectId.createFromHexString(audioId), userId }, { session: this.session }).toArray())[0]
    }

    async getForUserByTitle(title: string, userId: string): Promise<Audio> {
        return (await AudioRepository.collection!.find({ title, userId }, { session: this.session }).toArray())[0]
    }

    async getManyForUser(leafIds: string[], userId: string): Promise<Audio[]> {
        return await AudioRepository.collection!.find({ _id: { $in: leafIds.map(m => ObjectId.createFromHexString(m)) }, userId }, { session: this.session }).toArray()
    }

    async getByUserId(userId: string) {
        return await AudioRepository.collection!.find({ userId }, { session: this.session }).toArray()
    }

    getFromCursor(fromTsMs: number) {
        return AudioRepository.collection!.find({ updatedAt: { $gte: fromTsMs } })
    }

    getTemporariesFromCursor(fromTsMs: number) {
        return AudioRepository.collection!.find({ temporary: true, updatedAt: { $gte: fromTsMs } })
    }

    async updateTitle(audioId: string, title: string) {
        return await AudioRepository.collection!.updateOne({ _id: ObjectId.createFromHexString(audioId) }, { $set: { title, updatedAt: Date.now() } }, { session: this.session })
    }

    async unsafeUpdate(audioId: string, userId: string, updates: AudioUpdate) {
        return await AudioRepository.collection!.updateOne({ _id: ObjectId.createFromHexString(audioId), userId }, { $set: { ...updates, updatedAt: Date.now() } }, { session: this.session })
    }

    async delete(id: string): Promise<DeleteResult> {
        return await AudioRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id) }, { session: this.session })
    }

    async deleteBulk(ids: string[]): Promise<BulkWriteResult> {
        const bulkWrites: AnyBulkWriteOperation<any>[] = ids.map(id => ({ deleteOne: { filter: { _id: ObjectId.createFromHexString(id) } } }))
        return await AudioRepository.collection!.bulkWrite(bulkWrites, { session: this.session })
    }

    async deleteForUser(id: string, userId: string): Promise<DeleteResult> {
        return await AudioRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id), userId }, { session: this.session })
    }

    async deleteTemporaries(): Promise<DeleteResult> {
        return await AudioRepository.collection!.deleteMany({ temporary: true }, { session: this.session })
    }
}

export default AudioRepository;