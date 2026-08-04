import { AnyBulkWriteOperation, BulkWriteResult, ClientSession, Collection, Db, DeleteResult, InsertOneResult, ObjectId } from 'mongodb';
import { IDropable } from '../IDropable';
import { IRepository } from '../IRepository';
import { ISeedable } from '../ISeedable';
import { MongoDB } from '../mongodb';
import { collectionName, Image, ImageUpdate } from '../models/Image';

class ImageRepository implements IRepository, ISeedable, IDropable {
    IRepository: 'IRepository' = 'IRepository';
    ISeedable: 'ISeedable' = 'ISeedable';
    IDropable: 'IDropable' = 'IDropable';

    private session: ClientSession | undefined = undefined
    private static collection: Collection<Image> | undefined = undefined

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

        ImageRepository.collection = (await MongoDB.getDb()).collection<Image>(collectionName)
    }

    async dropCollection(db: Db): Promise<void> {
        await db.dropCollection(collectionName)
    }

    async insert(image: Image): Promise<InsertOneResult> {
        return await ImageRepository.collection!.insertOne({ ...image, updatedAt: Date.now(), createdAt: Date.now() }, { session: this.session })
    }

    async get(id: string): Promise<Image> {
        return (await ImageRepository.collection!.find({ temporary: false, _id: ObjectId.createFromHexString(id) }, { session: this.session }).toArray())[0]
    }

    async getForUser(imageId: string, userId: string): Promise<Image> {
        return (await ImageRepository.collection!.find({ temporary: false, _id: ObjectId.createFromHexString(imageId), userId }, { session: this.session }).toArray())[0]
    }

    async getForUserByTitle(title: string, userId: string) {
        return (await ImageRepository.collection!.find({ temporary: false, title, userId }, { session: this.session }).toArray())[0]
    }

    async getManyForUser(imageIds: string[], userId: string): Promise<Image[]> {
        return await ImageRepository.collection!.find({ temporary: false, _id: { $in: imageIds.map(m => ObjectId.createFromHexString(m)) }, userId }, { session: this.session }).toArray()
    }

    async getByUserId(userId: string) {
        return await ImageRepository.collection!.find({ temporary: false, userId }, { session: this.session }).toArray()
    }

    getFromCursor(fromTsMs: number) {
        return ImageRepository.collection!.find({ temporary: false, updatedAt: { $gte: fromTsMs } })
    }

    getTemporariesFromCursor(fromTsMs: number) {
        return ImageRepository.collection!.find({ temporary: true, updatedAt: { $gte: fromTsMs } })
    }

    async updateTitle(imageId: string, title: string) {
        return await ImageRepository.collection!.updateOne({ temporary: false, _id: ObjectId.createFromHexString(imageId) }, { $set: { title, updatedAt: Date.now() } }, { session: this.session })
    }

    async unsafeUpdate(audioId: string, userId: string, updates: ImageUpdate) {
        return await ImageRepository.collection!.updateOne({ _id: ObjectId.createFromHexString(audioId), userId }, { $set: { ...updates, updatedAt: Date.now() } }, { session: this.session })
    }

    async delete(id: string): Promise<DeleteResult> {
        return await ImageRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id) }, { session: this.session })
    }

    async deleteBulk(ids: string[]): Promise<BulkWriteResult> {
        const bulkWrites: AnyBulkWriteOperation<any>[] = ids.map(id => ({ deleteOne: { filter: { _id: ObjectId.createFromHexString(id) } } }))
        return await ImageRepository.collection!.bulkWrite(bulkWrites, { session: this.session })
    }

    async deleteForUser(id: string, userId: string): Promise<DeleteResult> {
        return await ImageRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id), userId }, { session: this.session })
    }

    async deleteTemporaries(): Promise<DeleteResult> {
        return await ImageRepository.collection!.deleteMany({ temporary: true }, { session: this.session })
    }
}

export default ImageRepository;