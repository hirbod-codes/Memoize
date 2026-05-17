import { ClientSession, Collection, Db, DeleteResult, InsertOneResult, ObjectId } from 'mongodb';
import { IDropable } from '../IDropable';
import { IRepository } from '../IRepository';
import { ISeedable } from '../ISeedable';
import { MongoDB } from '../mongodb';
import { collectionName, TreeNode } from '../models/TreeNode';

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

        if (indexes.find(i => i.name === 'title') === undefined)
            await db.createIndex(collectionName, { title: 1 }, { unique: true, name: 'title' })

        if (indexes.find(i => i.name === 'userId') === undefined)
            await db.createIndex(collectionName, { userId: 1 }, { name: 'userId' })

        if (indexes.find(i => i.name === 'root') === undefined)
            await db.createIndex(collectionName, { root: 1 }, { name: 'root' })

        if (indexes.find(i => i.name === 'createdAt') === undefined)
            await db.createIndex(collectionName, { createdAt: -1 }, { name: 'createdAt' })

        if (indexes.find(i => i.name === 'updatedAt') === undefined)
            await db.createIndex(collectionName, { updatedAt: -1 }, { name: 'updatedAt' })

        TreeNodeRepository.collection = (await MongoDB.getDb()).collection<TreeNode>(collectionName)
    }

    async dropCollection(db: Db): Promise<void> {
        await db.dropCollection(collectionName)
    }

    async insert(treeNode: TreeNode): Promise<InsertOneResult> {
        return await TreeNodeRepository.collection!.insertOne(treeNode, { session: this.session })
    }

    async get(id: string): Promise<TreeNode> {
        return (await TreeNodeRepository.collection!.find({ _id: ObjectId.createFromHexString(id) }, { session: this.session }).toArray())[0]
    }

    async getRootsForUser(userId: string, isRoot: boolean = true): Promise<TreeNode[]> {
        return await TreeNodeRepository.collection!.find({ userId: ObjectId.createFromHexString(userId), root: isRoot }, { session: this.session }).toArray()
    }

    async getManyForUser(treeNodeIds: string[], userId: string): Promise<TreeNode[]> {
        return await TreeNodeRepository.collection!.find({ _id: { $in: treeNodeIds.map(m => ObjectId.createFromHexString(m)) }, userId: ObjectId.createFromHexString(userId) }, { session: this.session }).toArray()
    }

    async getForUser(treeNodeId: string, userId: string): Promise<TreeNode> {
        return (await TreeNodeRepository.collection!.find({ _id: ObjectId.createFromHexString(treeNodeId), userId: ObjectId.createFromHexString(userId) }, { session: this.session }).toArray())[0]
    }

    async getByUserId(userId: string): Promise<TreeNode[]> {
        return await TreeNodeRepository.collection!.find({ userId: ObjectId.createFromHexString(userId) }, { session: this.session }).toArray()
    }

    async getByRoot(isRoot: boolean): Promise<TreeNode[]> {
        return await TreeNodeRepository.collection!.find({ root: isRoot }, { session: this.session }).toArray()
    }

    async delete(id: string): Promise<DeleteResult> {
        return await TreeNodeRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id) }, { session: this.session })
    }

    async deleteForUser(id: string, userId: string): Promise<DeleteResult> {
        return await TreeNodeRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id), userId: ObjectId.createFromHexString(userId) }, { session: this.session })
    }
}

export default TreeNodeRepository;