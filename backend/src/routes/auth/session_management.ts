import { randomBytes } from 'crypto';
import { Redis } from '../../DB/redis';

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const REVOKED_TOMBSTONE_TTL_SECONDS = REFRESH_TTL_SECONDS;

export type ClientType = 'web' | 'mobile' | 'desktop';

export interface RefreshRecord {
    userId: string;
    familyId: string;
    client: ClientType;
    userAgent?: string;
    createdAt: number;
}

function newToken(): string {
    return randomBytes(32).toString('base64url');
}

/**
 * Call on login/register. Starts a new rotation chain ("family") for this device/browser. 
 * 
 * `familyId` is what "logout this session" / session listing operate on; 
 * `tokenId` is the single-use refresh token handed to the client.
 * 
 * Each userId set has 'family id's and each 'family id' set has token ids
 */
export async function createSessionFamily(data: Omit<RefreshRecord, 'familyId' | 'createdAt'>): Promise<{ tokenId: string; familyId: string }> {
    const redis = await Redis.getClient();
    const familyId = newToken();
    const tokenId = newToken();
    const record: RefreshRecord = { ...data, familyId, createdAt: Date.now() };

    await redis.multi()
        .set(`refresh:${tokenId}`, JSON.stringify(record), 'EX', REFRESH_TTL_SECONDS)
        .sadd(`user_sessions:${data.userId}`, familyId)
        .expire(`user_sessions:${data.userId}`, REFRESH_TTL_SECONDS)
        .sadd(`refresh_family:${familyId}`, tokenId)
        .expire(`refresh_family:${familyId}`, REFRESH_TTL_SECONDS)
        .exec();

    return { tokenId, familyId };
}

/**
 * Rotates a refresh token: the old one is destroyed (and tombstoned) and a
 * new one is issued in the same family. If a tombstoned (already-rotated)
 * token is presented again, that's a replay — likely the token was stolen —
 * so the entire family is revoked, killing every token in that chain.
 */
export async function rotateRefreshToken(oldTokenId: string): Promise<RefreshRecord & { newTokenId: string }> {
    const redis = await Redis.getClient();

    const raw = await redis.get(`refresh:${oldTokenId}`);
    if (!raw) {
        const revokedRaw = await redis.get(`revoked:${oldTokenId}`);
        if (revokedRaw) {
            const { familyId, userId } = JSON.parse(revokedRaw);
            await revokeFamily(familyId, userId);
        }
        throw new Error('REFRESH_INVALID');
    }

    const record: RefreshRecord = JSON.parse(raw);
    const newTokenId = newToken();

    await redis.multi()
        .set(
            `revoked:${oldTokenId}`,
            JSON.stringify({ familyId: record.familyId, userId: record.userId }),
            'EX', REVOKED_TOMBSTONE_TTL_SECONDS
        )
        .del(`refresh:${oldTokenId}`)
        .set(`refresh:${newTokenId}`, JSON.stringify(record), 'EX', REFRESH_TTL_SECONDS)
        .sadd(`refresh_family:${record.familyId}`, newTokenId)
        .srem(`refresh_family:${record.familyId}`, oldTokenId)
        .expire(`refresh_family:${record.familyId}`, REFRESH_TTL_SECONDS)
        .expire(`user_sessions:${record.userId}`, REFRESH_TTL_SECONDS)
        .exec();

    return { ...record, newTokenId };
}

export async function revokeFamily(familyId: string, userId: string): Promise<void> {
    const redis = await Redis.getClient();
    const tokenIds = await redis.smembers(`refresh_family:${familyId}`);

    const pipeline = redis.multi();
    
    tokenIds.forEach(id => pipeline.del(`refresh:${id}`));
    
    pipeline.del(`refresh_family:${familyId}`);
    pipeline.srem(`user_sessions:${userId}`, familyId);
    
    await pipeline.exec();
}

export async function revokeAllSessions(userId: string): Promise<void> {
    const redis = await Redis.getClient();
    const familyIds = await redis.smembers(`user_sessions:${userId}`);

    for (const familyId of familyIds)
        await revokeFamily(familyId, userId);
}

/** Used by /logout: resolve a raw refresh token cookie/body value to its family and kill just that one */
export async function revokeSessionByTokenId(tokenId: string, userId: string): Promise<void> {
    const redis = await Redis.getClient();
    const raw = await redis.get(`refresh:${tokenId}`);
    if (!raw) return;
    const record: RefreshRecord = JSON.parse(raw);
    await revokeFamily(record.familyId, userId);
}

/** For a "your active sessions/devices" screen */
export async function listSessions(userId: string) {
    const redis = await Redis.getClient();
    const familyIds = await redis.smembers(`user_sessions:${userId}`);

    const sessions = [];
    for (const familyId of familyIds) {
        const tokenIds = await redis.smembers(`refresh_family:${familyId}`);
        if (tokenIds.length === 0) continue; // family exists but every token expired/rotated away

        // we don't care which token id we grab, we just need any one of them to read the shared metadata back out. tokenIds[0] is an arbitrary pick since SMEMBERS returns an unordered set.
        const raw = await redis.get(`refresh:${tokenIds[0]}`);
        // guard against a race condition, token might already be expired or deleted(e.g rotated out).
        if (!raw) continue;

        const record: RefreshRecord = JSON.parse(raw);
        sessions.push({
            familyId,
            client: record.client,
            userAgent: record.userAgent,
            createdAt: record.createdAt,
        });
    }
    return sessions;
}
