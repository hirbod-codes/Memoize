import { ClientSession, Collection, Db, DeleteResult, InsertOneResult, ObjectId } from 'mongodb';
import { IDropable } from '../IDropable';
import { IRepository } from '../IRepository';
import { ISeedable } from '../ISeedable';
import { MongoDB } from '../mongodb';
import { collectionName, Subscription, SubscriptionCreate, SubscriptionUpdate } from '../models/Subscription';
import { Redis } from '../redis';

class SubscriptionRepository implements IRepository, ISeedable, IDropable {
    IRepository: 'IRepository' = 'IRepository';
    ISeedable: 'ISeedable' = 'ISeedable';
    IDropable: 'IDropable' = 'IDropable';

    private session: ClientSession | undefined = undefined
    private static collection: Collection<Subscription> | undefined = undefined

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
            await db.createIndex(collectionName, { userId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['active', 'trialing'] } }, name: 'userId_active' })

        if (indexes.find(i => i.name === 'planTitle') === undefined)
            await db.createIndex(collectionName, { planTitle: 1 }, { name: 'planTitle' })

        if (indexes.find(i => i.name === 'createdAt') === undefined)
            await db.createIndex(collectionName, { createdAt: -1 }, { name: 'createdAt' })

        if (indexes.find(i => i.name === 'updatedAt') === undefined)
            await db.createIndex(collectionName, { updatedAt: -1 }, { name: 'updatedAt' })

        SubscriptionRepository.collection = (await MongoDB.getDb()).collection<Subscription>(collectionName)
    }

    async dropCollection(db: Db): Promise<void> {
        await db.dropCollection(collectionName)
    }

    async insert(plan: SubscriptionCreate): Promise<InsertOneResult> {
        return await SubscriptionRepository.collection!.insertOne({ ...plan, updatedAt: Date.now(), createdAt: Date.now() }, { session: this.session })
    }

    async get(id: string): Promise<Subscription> {
        return (await SubscriptionRepository.collection!.find({ _id: ObjectId.createFromHexString(id) }, { session: this.session }).toArray())[0]
    }

    async getActiveByUserId(userId: string): Promise<Subscription> {
        const redis = await Redis.getClient()

        const subscription = await redis.get(`${collectionName}:${userId}`)
        if (subscription)
            return JSON.parse(subscription)

        const result = (await SubscriptionRepository.collection!.find({ userId, status: 'active' }, { session: this.session }).toArray())[0]
        if (result)
            await redis.set(``, JSON.stringify(result))

        return result
    }

    async getByPlanTitleForUser(planTitle: string, userId: string): Promise<Subscription[]> {
        return await SubscriptionRepository.collection!.find({ planTitle, userId }, { session: this.session }).toArray()
    }

    async invalidate(userId: string) {
        const redis = await Redis.getClient()

        await redis.del(`${collectionName}:${userId}`)

        return await SubscriptionRepository.collection!.updateOne({ _id: ObjectId.createFromHexString(userId) }, { $set: { status: 'canceled', updatedAt: Date.now() } }, { session: this.session })
    }

    async invalidateForUser(userId: string) {
        const redis = await Redis.getClient()

        await redis.del(`${collectionName}:${userId}`)

        return await SubscriptionRepository.collection!.updateOne({ userId }, { $set: { status: 'canceled', updatedAt: Date.now() } }, { session: this.session })
    }

    async unsafeUpdate(subscriptionId: string, userId: string, updates: SubscriptionUpdate) {
        return await SubscriptionRepository.collection!.updateOne({ _id: ObjectId.createFromHexString(subscriptionId), userId }, { $set: { ...updates, updatedAt: Date.now() } }, { session: this.session })
    }

    async delete(id: string): Promise<DeleteResult> {
        return await SubscriptionRepository.collection!.deleteOne({ _id: ObjectId.createFromHexString(id) }, { session: this.session })
    }
}

export default SubscriptionRepository;