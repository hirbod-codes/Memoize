import { ClientSession, Collection, Db, DeleteResult, InsertOneResult, ObjectId } from 'mongodb';
import { IDropable } from '../IDropable';
import { IRepository } from '../IRepository';
import { ISeedable } from '../ISeedable';
import { MongoDB } from '../mongodb';
import { collectionName, Leaf } from '../models/Leaf';

class LeafRepository implements IRepository, ISeedable, IDropable {
    IRepository: 'IRepository' = 'IRepository';
    ISeedable: 'ISeedable' = 'ISeedable';
    IDropable: 'IDropable' = 'IDropable';

    private session: ClientSession | undefined = undefined
    private static collection: Collection<Leaf> | undefined = undefined

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
            await db.createIndex(collectionName, { title: 1 }, { unique: true, name: 'title' })

        if (indexes.find(i => i.name === 'userId') === undefined)
            await db.createIndex(collectionName, { userId: 1 }, { name: 'userId' })

        if (indexes.find(i => i.name === 'createdAt') === undefined)
            await db.createIndex(collectionName, { createdAt: -1 }, { name: 'createdAt' })

        if (indexes.find(i => i.name === 'updatedAt') === undefined)
            await db.createIndex(collectionName, { updatedAt: -1 }, { name: 'updatedAt' })

        LeafRepository.collection = (await MongoDB.getDb()).collection<Leaf>(collectionName)
    }

    async dropCollection(db: Db): Promise<void> {
        await db.dropCollection(collectionName)
    }

    async insert(leaf: Leaf): Promise<InsertOneResult> {
        return await LeafRepository.collection!.insertOne(leaf, { session: this.session })
    }

    async get(id: string): Promise<Leaf> {
        return (await LeafRepository.collection!.find({ _id: ObjectId.createFromHexString(id) }, { session: this.session }).toArray())[0]
    }

    async getForUser(leafId: string, userId: string): Promise<Leaf> {
        return (await LeafRepository.collection!.find({ _id: ObjectId.createFromHexString(leafId), userId: ObjectId.createFromHexString(userId) }, { session: this.session }).toArray())[0]
    }

    async getManyForUser(leafIds: string[], userId: string): Promise<Leaf[]> {
        return await LeafRepository.collection!.find({ _id: { $in: leafIds.map(m => ObjectId.createFromHexString(m)) }, userId: ObjectId.createFromHexString(userId) }, { session: this.session }).toArray()
    }

    async getByUserId(userId: string) {
        return await LeafRepository.collection!.find({ userId: ObjectId.createFromHexString(userId) }, { session: this.session }).toArray()
    }

    async replace(leaf: Leaf) {
        return await LeafRepository.collection!.replaceOne({ _id: ObjectId.createFromHexString(leaf._id!.toString()) }, leaf)
    }

    async delete(id: string): Promise<DeleteResult> {
        return await LeafRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id) }, { session: this.session })
    }

    async deleteForUser(id: string, userId: string): Promise<DeleteResult> {
        return await LeafRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id), userId: ObjectId.createFromHexString(userId) }, { session: this.session })
    }
}

export default LeafRepository;