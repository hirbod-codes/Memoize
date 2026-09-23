import { ClientSession, Collection, Db, DeleteResult, Filter, InsertOneResult, ObjectId } from 'mongodb';
import { IDropable } from '../IDropable';
import { IRepository } from '../IRepository';
import { ISeedable } from '../ISeedable';
import { MongoDB } from '../mongodb';
import { collectionName, schemaVersion, TreeNode, TreeNodeCreate, TreeNodeUpdate } from '../models/TreeNode';

class TreeNodeRepository implements IRepository, ISeedable, IDropable {
    IRepository: 'IRepository' = 'IRepository';
    ISeedable: 'ISeedable' = 'ISeedable';
    IDropable: 'IDropable' = 'IDropable';

    private session: ClientSession | undefined = undefined
    private static collection: Collection<TreeNode> | undefined = undefined

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

        if (indexes.find(i => i.name === 'hierarchyLevel') === undefined)
            await db.createIndex(collectionName, { hierarchyLevel: 1 }, { name: 'hierarchyLevel' })

        if (indexes.find(i => i.name === 'createdAt') === undefined)
            await db.createIndex(collectionName, { createdAt: -1 }, { name: 'createdAt' })

        if (indexes.find(i => i.name === 'updatedAt') === undefined)
            await db.createIndex(collectionName, { updatedAt: -1 }, { name: 'updatedAt' })

        TreeNodeRepository.collection = (await MongoDB.getDb()).collection<TreeNode>(collectionName)
    }

    async dropCollection(db: Db): Promise<void> {
        await db.dropCollection(collectionName)
    }

    async insert(treeNode: TreeNodeCreate): Promise<InsertOneResult> {
        if (!treeNode.parentId)
            return await TreeNodeRepository.collection!.insertOne({ ...treeNode, hierarchy: ['root'], hierarchyLevel: 1, schemaVersion, updatedAt: Date.now(), createdAt: Date.now() }, { session: this.session });

        const hierarchy = (await this.get(treeNode.parentId!)).hierarchy
        hierarchy.push(treeNode.parentId!)

        return await TreeNodeRepository.collection!.insertOne({ ...treeNode, hierarchy, hierarchyLevel: hierarchy.length, schemaVersion, updatedAt: Date.now(), createdAt: Date.now() }, { session: this.session });
    }

    async get(id: string): Promise<TreeNode> {
        return (await TreeNodeRepository.collection!.find({ _id: ObjectId.createFromHexString(id) }, { session: this.session }).toArray())[0]
    }

    async getRootsForUser(userId: string): Promise<TreeNode[]> {
        return await TreeNodeRepository.collection!.find({ userId, parentId: undefined }, { session: this.session }).toArray()
    }

    async getByParentIdForUser(parentId: string, userId: string) {
        return await TreeNodeRepository.collection!.find({ parentId, userId }, { session: this.session }).toArray()
    }

    async getManyForUser(treeNodeIds: string[], userId: string): Promise<TreeNode[]> {
        return await TreeNodeRepository.collection!.find({ _id: { $in: treeNodeIds.map(m => ObjectId.createFromHexString(m)) }, userId }, { session: this.session }).toArray()
    }

    async getManyForUserByParentId(treeNodeIds: string[], userId: string, parentId?: string): Promise<TreeNode[]> {
        return await TreeNodeRepository.collection!.find({ _id: { $in: treeNodeIds.map(m => ObjectId.createFromHexString(m)) }, userId, parentId }, { session: this.session }).toArray()
    }

    async getForUser(treeNodeId: string, userId: string): Promise<TreeNode> {
        return (await TreeNodeRepository.collection!.find({ _id: ObjectId.createFromHexString(treeNodeId), userId }, { session: this.session }).toArray())[0]
    }

    async getByUserId(userId: string): Promise<TreeNode[]> {
        return await TreeNodeRepository.collection!.find({ userId }, { session: this.session }).toArray()
    }

    async getByRoot(): Promise<TreeNode[]> {
        return await TreeNodeRepository.collection!.find({ parentId: undefined }, { session: this.session }).toArray()
    }

    getFromCursor(from: number) {
        return TreeNodeRepository.collection!.find({ updatedAt: { $gte: from } }, { session: this.session })
    }

    async getRootsForUserPaginated(userId: string, limit: number, skip: number, search?: string) {
        let filter: Filter<TreeNode> = { userId, parentId: undefined }
        if (search)
            filter['$text'] = { '$search': search }
        console.log({ filter })
        return await TreeNodeRepository.collection!.find(filter, { session: this.session }).sort({ _id: -1 }).skip(skip).limit(limit).toArray()
    }

    async getChildrenForUserPaginated(userId: string, parentId: string, limit: number, skip: number, search?: string) {
        let filter: Filter<TreeNode> = { userId, parentId }
        if (search)
            filter['$text'] = { '$search': search }
        return await TreeNodeRepository.collection!.find(filter, { session: this.session }).sort({ _id: -1 }).skip(skip).limit(limit).toArray()
    }

    async countCategoriesPerNestedLevelForUser(userId: string, level: number) {
        return await TreeNodeRepository.collection!.countDocuments({ userId, hierarchyLevel: level }, { session: this.session })
    }

    async countMaxNestedLevelsForUser(userId: string) {
        return (await TreeNodeRepository.collection!.findOne({ userId }, { sort: [['hierarchyLevel', -1]], session: this.session }))?.hierarchyLevel
    }

    async replace(treeNodeArg: TreeNodeUpdate) {
        const { _id, ...treeNode } = treeNodeArg

        let hierarchy
        if (treeNode.parentId) {
            hierarchy = (await this.get(treeNode.parentId)).hierarchy
            hierarchy.push(treeNode.parentId!);
        }
        return await TreeNodeRepository.collection!.updateOne({ _id: ObjectId.createFromHexString(_id!.toString()) }, { $set: { ...treeNode, ...(hierarchy ? { hierarchy, hierarchyLevel: hierarchy.length } : {}), updatedAt: Date.now() } })
    }

    async replaceForUser(treeNodeArg: TreeNodeUpdate, userId: string) {
        const { _id, ...treeNode } = treeNodeArg

        let hierarchy
        if (treeNode.parentId) {
            hierarchy = (await this.get(treeNode.parentId)).hierarchy
            hierarchy.push(treeNode.parentId!);
        }
        return await TreeNodeRepository.collection!.updateOne({ userId, _id: ObjectId.createFromHexString(_id!.toString()) }, { $set: { ...treeNode, ...(hierarchy ? { hierarchy, hierarchyLevel: hierarchy.length } : {}), updatedAt: Date.now() } })
    }

    async delete(id: string): Promise<DeleteResult> {
        return await TreeNodeRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id) }, { session: this.session })
    }

    async deleteForUser(id: string, userId: string): Promise<DeleteResult> {
        return await TreeNodeRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id), userId }, { session: this.session })
    }
}

export default TreeNodeRepository;