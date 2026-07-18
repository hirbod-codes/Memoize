import crypto from 'crypto';
import { streamSigningSecret } from '..';

export function generateStreamToken(videoId: string, userId: string, ttlSeconds = 60 * 60 * 6): string {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = `${videoId}.${userId}.${exp}`;
    const signature = crypto.createHmac('sha256', streamSigningSecret).update(payload).digest('hex');
    // token = payload + signature, base64url-encoded so it's URL-safe
    const token = Buffer.from(`${payload}.${signature}`).toString('base64url');
    return token;
}

export function verifyStreamToken(token: string, videoId: string): { valid: boolean; userId?: string } {
    try {
        const decoded = Buffer.from(token, 'base64url').toString('utf8');
        const [tokenVideoId, userId, expStr, signature] = decoded.split('.');
        const exp = parseInt(expStr, 10);

        if (tokenVideoId !== videoId) return { valid: false };
        if (Date.now() / 1000 > exp) return { valid: false };

        const payload = `${tokenVideoId}.${userId}.${expStr}`;
        const expectedSig = crypto.createHmac('sha256', streamSigningSecret).update(payload).digest('hex');

        // timing-safe compare
        const sigBuf = Buffer.from(signature, 'hex');
        const expectedBuf = Buffer.from(expectedSig, 'hex');
        if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
            return { valid: false };
        }

        return { valid: true, userId };
    } catch {
        return { valid: false };
    }
}