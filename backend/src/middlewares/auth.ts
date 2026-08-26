import jwt from "jsonwebtoken"
import { Request, Response, NextFunction } from "express";
import { accessTokenSecret } from '../configs';
import { UserRepository } from "../DB/repositories/UserRepository";
import { isAccessTokenBlacklisted } from "../routes/auth/token_management";
import { getLogger } from '../observability/requestContext';

/**
 * DOES NOT FORBID unauthenticated users.
 */
export async function isAdminIfAuthenticated(req: Request, res: Response, next: NextFunction) {
    const log = getLogger().child({ module: 'auth-middleware', middleware: 'isAdminIfAuthenticated' });
    const result = authenticateRequest(req)
    if (!result)
        return next();

    try {
        const payload = result as jwt.JwtPayload & { userId: string; jti?: string };

        if (payload.jti && await isAccessTokenBlacklisted(payload.jti)) {
            log.warn({ userId: payload.userId }, 'Rejected: access token blacklisted');
            return res.status(403).send();
        }

        const ur = new UserRepository()
        const u = await ur.get(payload.userId)
        if (!u || u.role !== 'admin') {
            log.debug({ userId: payload.userId }, 'Not an admin');
            return res.status(403).send();
        }

        log.debug({ userId: payload.userId }, 'Confirmed admin');
        next();
    } catch (err) {
        log.error({ err }, 'Error while checking admin status');
        return res.status(403).send();
    }
}

export async function auth(req: Request, res: Response, next: NextFunction) {
    const log = getLogger().child({ module: 'auth-middleware', middleware: 'auth' });
    const result = authenticateRequest(req)
    if (!result) {
        log.debug('Rejected: no valid auth token found');
        return res.status(401).send();
    }

    let userObject
    if (typeof result === 'string')
        userObject = { userId: result }
    else
        userObject = result

    if (typeof result !== 'string' && result.jti && await isAccessTokenBlacklisted(result.jti)) {
        log.warn({ userId: userObject.userId }, 'Rejected: access token blacklisted');
        return res.status(401).send();
    }

    const user = await (new UserRepository()).get(userObject.userId)
    if (!user) {
        log.warn({ userId: userObject.userId }, 'Rejected: token valid but user no longer exists');
        return res.status(401).send();
    }

    // NOTE: only userId/userData are copied onto req.user here — jti/exp
    // from the decoded payload are not, even though they're available in
    // `result`/`userObject`. Downstream code (e.g. /logout) that reads
    // req.user.jti will always get undefined. Not fixed here (logging-only
    // pass) — flagging since it means access-token blacklisting on logout
    // never actually fires.
    if (!req.user)
        req.user = {
            userId: userObject.userId,
            userData: user,
        }
    else {
        req.user!.userId = userObject.userId;
        req.user!.userData = user;
    }

    log.debug({ userId: userObject.userId }, 'Authenticated');
    next();
}

/**
 * @param req
 * @returns user id in a string or a jwt.JwtPayload
 */
export function authenticateRequest(req: Request): string | false | jwt.JwtPayload {
    const authToken = collectAuthToken(req)
    if (!authToken)
        return false

    return authenticateToken(authToken);
}

/**
 * @param token The JWT access token
 * @returns user id in a string or a jwt.JwtPayload
 */
export function authenticateToken(token: string): string | false | jwt.JwtPayload {
    if (!token)
        return false

    try {
        const decoded = jwt.verify(token, accessTokenSecret);
        return decoded;
    } catch (err) {
        // Expired/invalid tokens are routine (every access token expires
        // every 15 minutes) — debug, not error. err.message is safe to log
        // (e.g. "jwt expired"); the token itself never is.
        getLogger().debug({ module: 'auth-middleware', reason: (err as Error).message }, 'Access token verification failed');
        return false
    }
}

function collectAuthToken(req: Request): string | undefined | null {
    let authToken = req.headers?.authorization || req.cookies?.accessToken;
    if (!authToken)
        return undefined

    return req.headers?.authorization ? authToken.split(" ")[1] : authToken;
}

export function unAuth(req: Request, res: Response, next: NextFunction) {
    const authToken = collectAuthToken(req)

    if (authToken) {
        getLogger().debug({ module: 'auth-middleware', middleware: 'unAuth' }, 'Rejected: expected unauthenticated request but auth header present');
        return res.status(401).send();
    }

    next();
}
