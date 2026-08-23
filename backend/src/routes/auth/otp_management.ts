import { randomInt, createHash } from 'crypto';
import { Redis } from '../../DB/redis';
import { smsProvider } from '../../configs';
import { otpService } from '../..';
import { getLogger } from '../../observability/requestContext';

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
    const log = getLogger().child({ module: 'otp', phoneNumber, purpose });
    const redis = await Redis.getClient();

    const cooldownKey = `otp_cooldown:${phoneNumber}`;
    if (await redis.exists(cooldownKey)) {
        log.debug('OTP request blocked by cooldown');
        return 'cooldown';
    }

    const code = randomInt(100000, 999999).toString();
    // Never log `code` or the resulting codeHash. codeHash is a fast,
    // unsalted-beyond-phone-number SHA-256 digest of a 6-digit code — for
    // anyone who also knows the phone number (which is right next to it in
    // every log line), that's a ~10^6-guess brute force, i.e. equivalent to
    // logging the code itself.
    const record: OtpRecord = { codeHash: hashCode(code, phoneNumber), attempts: 0, purpose };

    await redis.set(`otp:${phoneNumber}`, JSON.stringify(record), 'EX', OTP_TTL_SECONDS);
    await redis.set(cooldownKey, '1', 'EX', OTP_REQUEST_COOLDOWN_SECONDS);

    await otpService.sendVerificationMessage(code, phoneNumber, locale);
    log.info({ locale }, 'OTP sent');

    return 'sent';
}

export async function verifyOtp(phoneNumber: string, code: string, purpose: OtpPurpose): Promise<boolean> {
    const log = getLogger().child({ module: 'otp', phoneNumber, purpose });
    const redis = await Redis.getClient();
    const key = `otp:${phoneNumber}`;

    const raw = await redis.get(key);
    if (!raw) {
        log.debug('OTP verification failed: no active code (expired or never requested)');
        return false; // expired or never requested
    }

    const record: OtpRecord = JSON.parse(raw);
    if (record.purpose !== purpose) {
        log.warn({ recordPurpose: record.purpose }, 'OTP verification failed: purpose mismatch');
        return false;
    }

    if (record.attempts >= MAX_ATTEMPTS) {
        log.warn({ attempts: record.attempts }, 'OTP verification failed: max attempts exceeded, code burned');
        await redis.del(key); // burn it, force a new request
        return false;
    }

    if (record.codeHash !== hashCode(code, phoneNumber)) {
        record.attempts += 1;
        const ttl = await redis.ttl(key);
        await redis.set(key, JSON.stringify(record), 'EX', ttl > 0 ? ttl : OTP_TTL_SECONDS);
        log.info({ attempts: record.attempts }, 'OTP verification failed: incorrect code');
        return false;
    }

    await redis.del(key); // one-time use
    log.info('OTP verified');
    return true;
}
