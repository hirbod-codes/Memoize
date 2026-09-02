import { ClientSession, Collection, Db, DeleteResult, InsertOneResult, ObjectId, UpdateResult, WithId } from 'mongodb';
import { IDropable } from '../IDropable';
import { IRepository } from '../IRepository';
import { ISeedable } from '../ISeedable';
import { MongoDB } from '../mongodb';
import { collectionName, Usage, UsageCreate, UsageField, UsageUpdate } from '../models/Usage';

class UsageRepository implements IRepository, ISeedable, IDropable {
    IRepository: 'IRepository' = 'IRepository';
    ISeedable: 'ISeedable' = 'ISeedable';
    IDropable: 'IDropable' = 'IDropable';

    private session: ClientSession | undefined = undefined
    private static collection: Collection<Usage> | undefined = undefined

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

        if (indexes.find(i => i.name === 'userId') === undefined)
            await db.createIndex(collectionName, { userId: 1 }, { unique: true, name: 'userId' })

        if (indexes.find(i => i.name === 'createdAt') === undefined)
            await db.createIndex(collectionName, { createdAt: -1 }, { name: 'createdAt' })

        if (indexes.find(i => i.name === 'updatedAt') === undefined)
            await db.createIndex(collectionName, { updatedAt: -1 }, { name: 'updatedAt' })

        UsageRepository.collection = (await MongoDB.getDb()).collection<Usage>(collectionName)
    }

    async dropCollection(db: Db): Promise<void> {
        await db.dropCollection(collectionName)
    }

    async insert(plan: UsageCreate): Promise<InsertOneResult> {
        return await UsageRepository.collection!.insertOne({ ...plan, updatedAt: Date.now(), createdAt: Date.now() }, { session: this.session })
    }

    async get(id: string): Promise<Usage> {
        return (await UsageRepository.collection!.find({ _id: ObjectId.createFromHexString(id) }, { session: this.session }).toArray())[0]
    }

    async getByUserId(userId: string): Promise<Usage | undefined> {
        let usage = (await UsageRepository.collection!.find({ userId }, { session: this.session }).toArray())[0]

        if (!usage) {
            const result = await this.insert({
                userId, cardsPerCategoryCount: 0,
                categoriesCount: 0,
                nestedCategoriesCount: 0,
                contentsPerCardSideCount: 0,
                storageBytesCount: 0,
                valuePerContentCount: {
                    audio: 0,
                    image: 0,
                    video: 0,
                    richText: 0,
                    string: 0
                }
            })

            if (!result.acknowledged)
                return undefined
        }

        return (await UsageRepository.collection!.find({ userId }, { session: this.session }).toArray())[0]
    }

    async unsafeUpdateForUser(usageId: string, userId: string, updates: UsageUpdate) {
        return await UsageRepository.collection!.updateOne({ _id: ObjectId.createFromHexString(usageId), userId }, { $set: { ...updates, updatedAt: Date.now() } }, { session: this.session })
    }

    /**
     * @returns Return null if quota would be exceeded, WithId<Usage> otherwise.
     */
    async tryIncrementQuota(userId: string, usageField: UsageField, amount: number, quotaLimit: number): Promise<WithId<Usage> | null> {
        if (!Number.isInteger(amount))
            throw new Error('NON_INTEGER_INCREMENT')

        return await UsageRepository.collection!.findOneAndUpdate({ userId, [usageField]: { $lte: quotaLimit - amount } }, { $inc: { [usageField]: amount }, $set: { updatedAt: Date.now() } }, { session: this.session })
    }

    async decrementQuota(userId: string, usageField: UsageField, amount: number): Promise<UpdateResult> {
        return await UsageRepository.collection!.updateOne({ userId, [usageField]: { $gte: amount } }, { $inc: { [usageField]: -amount }, $set: { updatedAt: Date.now() } }, { session: this.session });
    }

    /**
     * @returns Return null if quota would be exceeded, WithId<Usage> otherwise.
     */
    async tryIncrementQuotas(userId: string, usageFields: Map<UsageField, { amount: number, limit: number }>): Promise<WithId<Usage> | null> {
        const update: { [k: string]: number } = {}
        const filter: { [k: string]: { $lte: number } } = {}

        for (const [usageField, { amount, limit }] of usageFields.entries()) {
            if (!Number.isInteger(amount) || !Number.isInteger(limit) || limit < 0 || amount < 0)
                throw new Error('INVALID_INTEGER')

            filter[usageField] = { $lte: limit - amount }
            update[usageField] = amount
        }

        return await UsageRepository.collection!.findOneAndUpdate({ userId, ...filter }, { $inc: { ...update }, $set: { updatedAt: Date.now() } }, { session: this.session })
    }

    async decrementQuotas(userId: string, usageFields: Map<UsageField, number>): Promise<UpdateResult> {
        const update: { [k: string]: number } = {}
        const filter: { [k: string]: { $gte: number } } = {}

        for (const [usageField, amount] of usageFields.entries()) {
            if (!Number.isInteger(amount) || amount < 0)
                throw new Error('INVALID_INTEGER')

            filter[usageField] = { $gte: amount }
            update[usageField] = -amount
        }

        return await UsageRepository.collection!.updateOne({ userId, ...filter }, { $inc: { ...update }, $set: { updatedAt: Date.now() } }, { session: this.session });
    }

    async delete(id: string): Promise<DeleteResult> {
        return await UsageRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id) }, { session: this.session })
    }
}

export default UsageRepository;