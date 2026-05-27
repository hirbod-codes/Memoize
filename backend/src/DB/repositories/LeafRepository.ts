import { ClientSession, Collection, Db, DeleteResult, Filter, InsertOneResult, ObjectId } from 'mongodb';
import { IDropable } from '../IDropable';
import { IRepository } from '../IRepository';
import { ISeedable } from '../ISeedable';
import { MongoDB } from '../mongodb';
import { collectionName, Leaf, LeafCreate, LeafUpdate, schemaVersion } from '../models/Leaf';

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

        if (indexes.find(i => i.name === 'text-title') === undefined)
            await db.createIndex(collectionName, { title: 'text' }, { name: 'text-title' })

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

    async insert(leaf: LeafCreate): Promise<InsertOneResult> {
        return await LeafRepository.collection!.insertOne({ ...leaf, schemaVersion, updatedAt: Date.now(), createdAt: Date.now() }, { session: this.session })
    }

    getFromCursor(from: number) {
        return LeafRepository.collection!.find({ updatedAt: { $gte: from } }, { session: this.session })
    }

    async get(id: string): Promise<Leaf> {
        return (await LeafRepository.collection!.find({ _id: ObjectId.createFromHexString(id) }, { session: this.session }).toArray())[0]
    }

    async getForUser(leafId: string, userId: string): Promise<Leaf> {
        return (await LeafRepository.collection!.find({ _id: ObjectId.createFromHexString(leafId), userId }, { session: this.session }).toArray())[0]
    }

    async getManyForUser(leafIds: string[], userId: string): Promise<Leaf[]> {
        return await LeafRepository.collection!.find({ _id: { $in: leafIds.map(m => ObjectId.createFromHexString(m)) }, userId }, { session: this.session }).toArray()
    }

    async getManyForUserByParentTreeNodeId(leafIds: string[], parentTreeNodeId: string, userId: string) {
        return await LeafRepository.collection!.find({ _id: { $in: leafIds.map(m => ObjectId.createFromHexString(m)) }, treeNodeId: parentTreeNodeId, userId }, { session: this.session }).toArray()
    }

    async getForUserByParentTreeNode(parentTreeNodeId: string, userId: string) {
        return await LeafRepository.collection!.find({ treeNodeId: parentTreeNodeId, userId }, { session: this.session }).toArray()
    }

    async getByUserId(userId: string) {
        return await LeafRepository.collection!.find({ userId }, { session: this.session }).toArray()
    }

    async videoIdExistsFrom(videoId: string, fromTsMs: number) {
        return (await LeafRepository.collection!.countDocuments({ $or: [{ definitionContents: { $elemMatch: { type: 'videoId', value: videoId } }, updatedAt: { $gte: fromTsMs } }, { termContents: { $elemMatch: { type: 'videoId', value: videoId } }, updatedAt: { $gte: fromTsMs } }] })) > 0
    }

    async imageIdExistsFrom(imageId: string, fromTsMs: number) {
        return (await LeafRepository.collection!.countDocuments({ $or: [{ definitionContents: { $elemMatch: { type: 'imageId', value: imageId } }, updatedAt: { $gte: fromTsMs } }, { termContents: { $elemMatch: { type: 'imageId', value: imageId } }, updatedAt: { $gte: fromTsMs } }] })) > 0
    }

    async audioIdExistsFrom(audioId: string, fromTsMs: number) {
        return (await LeafRepository.collection!.countDocuments({ $or: [{ definitionContents: { $elemMatch: { type: 'audioId', value: audioId } }, updatedAt: { $gte: fromTsMs } }, { termContents: { $elemMatch: { type: 'audioId', value: audioId } }, updatedAt: { $gte: fromTsMs } }] })) > 0
    }

    async getForUserPaginated(userId: string, parentId: string, limit: number, skip: number, search?: string) {
        let filter: Filter<Leaf> = { userId, treeNodeId: parentId }
        if (search)
            filter['$text'] = { '$search': search }
        return await LeafRepository.collection!.find(filter, { session: this.session }).sort({ _id: -1 }).skip(skip).limit(limit).toArray()
    }

    async replace(leafArg: LeafUpdate) {
        const { _id, ...leaf } = leafArg
        return await LeafRepository.collection!.updateOne({ _id: ObjectId.createFromHexString(_id!.toString()) }, { $set: { ...leaf, updatedAt: Date.now() } })
    }

    async replaceForUser(leafArg: LeafUpdate, userId: string) {
        const { _id, ...leaf } = leafArg
        return await LeafRepository.collection!.updateOne({ userId, _id: ObjectId.createFromHexString(_id!.toString()) }, { $set: { ...leaf, updatedAt: Date.now() } })
    }

    async delete(id: string): Promise<DeleteResult> {
        return await LeafRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id) }, { session: this.session })
    }

    async deleteForUser(id: string, userId: string): Promise<DeleteResult> {
        return await LeafRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id), userId }, { session: this.session })
    }
}

export default LeafRepository;