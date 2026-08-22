import { randomInt, createHash } from 'crypto';
import { Redis } from '../../DB/redis';
import { smsProvider } from '../../configs';
import { otpService } from '../..';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_REQUEST_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

type OtpPurpose = 'login' | 'register';

interface OtpRecord {
    codeHash: string;
    attempts: number;
    purpose: OtpPurpose;
}

function hashCode(code: string, phoneNumber: string): string {
    // salted with the phone number so a leaked hash table isn't directly usable
    return createHash('sha256').update(`${code}:${phoneNumber}`).digest('hex');
}

/**
 * `purpose` is tagged onto the record and checked on verify, so a code
 * requested for registration can't be replayed to log into an existing
 * account (or vice versa) if the two flows ever share a phone number window.
 */
export async function requestOtp(phoneNumber: string, purpose: OtpPurpose, locale: 'en' | 'fa'): Promise<'sent' | 'cooldown'> {
    const redis = await Redis.getClient();

    const cooldownKey = `otp_cooldown:${phoneNumber}`;
    if (await redis.exists(cooldownKey))
        return 'cooldown';

    const code = randomInt(100000, 999999).toString();
    const record: OtpRecord = { codeHash: hashCode(code, phoneNumber), attempts: 0, purpose };

    await redis.set(`otp:${phoneNumber}`, JSON.stringify(record), 'EX', OTP_TTL_SECONDS);
    await redis.set(cooldownKey, '1', 'EX', OTP_REQUEST_COOLDOWN_SECONDS);

    await otpService.sendVerificationMessage(code, phoneNumber, locale);

    return 'sent';
}

export async function verifyOtp(phoneNumber: string, code: string, purpose: OtpPurpose): Promise<boolean> {
    const redis = await Redis.getClient();
    const key = `otp:${phoneNumber}`;

    const raw = await redis.get(key);
    if (!raw) return false; // expired or never requested

    const record: OtpRecord = JSON.parse(raw);
    if (record.purpose !== purpose) return false;

    if (record.attempts >= MAX_ATTEMPTS) {
        await redis.del(key); // burn it, force a new request
        return false;
    }

    if (record.codeHash !== hashCode(code, phoneNumber)) {
        record.attempts += 1;
        const ttl = await redis.ttl(key);
        await redis.set(key, JSON.stringify(record), 'EX', ttl > 0 ? ttl : OTP_TTL_SECONDS);
        return false;
    }

    await redis.del(key); // one-time use
    return true;
}
