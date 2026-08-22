import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { accessTokenSecret } from '../../configs';
import { Redis } from '../../DB/redis';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AccessTokenPayload extends jwt.JwtPayload {
    userId: string;
    jti: string;
}

/**
 * `exp` is set explicitly in the payload (rather than via jsonwebtoken's
 * `expiresIn` option) so we can reuse the same value to size the blacklist
 * TTL on logout without re-decoding the token.
 */
export function signAccessToken(userId: string): { token: string; jti: string; exp: number } {
    const jti = randomBytes(16).toString('hex');
    const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;

    const token = jwt.sign({ userId, jti, exp }, accessTokenSecret);

    return { token, jti, exp };
}

export async function blacklistAccessToken(jti: string, exp: number): Promise<void> {
    const redis = await Redis.getClient();
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl >= 0)
        await redis.set(`access_blacklist:${jti}`, '1', 'EX', ttl);
}

export async function isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    const redis = await Redis.getClient();
    return (await redis.exists(`access_blacklist:${jti}`)) === 1;
}