import { ClientSession, Collection, Db, DeleteResult, InsertOneResult, ObjectId, UpdateResult } from 'mongodb';
import { IDropable } from '../IDropable';
import { IRepository } from '../IRepository';
import { ISeedable } from '../ISeedable';
import { collectionName, User } from '../models/User';
import { MongoDB } from '../mongodb';

export class UserRepository implements IRepository, ISeedable, IDropable {
    IDropable: 'IDropable' = 'IDropable';
    IRepository: 'IRepository' = 'IRepository';
    ISeedable: 'ISeedable' = 'ISeedable';

    private session: ClientSession | undefined = undefined
    private static collection: Collection<User> | undefined = undefined

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

        if (indexes.find(i => i.name === 'unique-username') === undefined)
            await db.createIndex(collectionName, { username: 1 }, { unique: true, name: 'unique-username' })

        if (indexes.find(i => i.name === 'unique-email') === undefined)
            await db.createIndex(collectionName, { email: 1 }, { sparse: true, name: 'email' })

        if (indexes.find(i => i.name === 'unique-phoneNumber') === undefined)
            await db.createIndex(collectionName, { phoneNumber: 1 }, { sparse: true, name: 'phoneNumber' })

        if (indexes.find(i => i.name === 'createdAt') === undefined)
            await db.createIndex(collectionName, { createdAt: -1 }, { name: 'createdAt' })

        if (indexes.find(i => i.name === 'updatedAt') === undefined)
            await db.createIndex(collectionName, { updatedAt: -1 }, { name: 'updatedAt' })

        UserRepository.collection = (await MongoDB.getDb()).collection<User>(collectionName)
    }

    async dropCollection(db: Db): Promise<void> {
        await db.dropCollection(collectionName)
    }

    async create(user: User): Promise<InsertOneResult | false> {
        try {
            return await UserRepository.collection!.insertOne(user)
        } catch (err) {
            console.error(err)
            return false
        }
    }

    async get(id: string) {
        try {
            return (await UserRepository.collection!.find({ _id: ObjectId.createFromHexString(id) }).toArray())[0]
        } catch (err) {
            console.error(err)
            return false
        }
    }

    async getByUsername(username: string) {
        try {
            return (await UserRepository.collection!.find({ username }).toArray())[0]
        } catch (err) {
            console.error(err)
            return false
        }
    }

    async getByEmail(email: string) {
        try {
            return (await UserRepository.collection!.find({ email }).toArray())[0]
        } catch (err) {
            console.error(err)
            return false
        }
    }

    async getByPhoneNumber(phoneNumber: string) {
        try {
            return (await UserRepository.collection!.find({ phoneNumber }).toArray())[0]
        } catch (err) {
            console.error(err)
            return false
        }
    }

    async updateRefreshToken(id: string, refreshToken: string) {
        try {
            return await UserRepository.collection!.updateOne({ _id: ObjectId.createFromHexString(id) }, { $set: { refreshToken: refreshToken } })
        } catch (err) {
            console.error(err)
            return false
        }
    }
}
