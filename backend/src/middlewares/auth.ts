import jwt from "jsonwebtoken"
import { Request, Response, NextFunction } from "express";
import { accessTokenSecret } from '../configs';
import { UserRepository } from "../DB/repositories/UserRepository";
import { isAccessTokenBlacklisted } from "../routes/auth/token_management";

/**
 * DOES NOT FORBID unauthenticated users.
 */
export async function isAdminIfAuthenticated(req: Request, res: Response, next: NextFunction) {
    const result = authenticateRequest(req)
    if (!result)
        return next();

    try {
        const payload = result as jwt.JwtPayload & { userId: string; jti?: string };

        if (payload.jti && await isAccessTokenBlacklisted(payload.jti))
            return res.status(403).send();

        const ur = new UserRepository()
        const u = await ur.get(payload.userId)
        if (!u || u.role !== 'admin')
            return res.status(403).send();

        next();
    } catch (err) {
        console.error(err);
        return res.status(403).send();
    }
}

export async function auth(req: Request, res: Response, next: NextFunction) {
    const result = authenticateRequest(req)
    if (!result)
        return res.status(401).send();

    let userObject
    if (typeof result === 'string')
        userObject = { userId: result }
    else
        userObject = result

    if (typeof result !== 'string' && result.jti && await isAccessTokenBlacklisted(result.jti))
        return res.status(401).send();

    const user = await (new UserRepository()).get(userObject.userId)
    if (!user)
        return res.status(401).send();

    if (!req.user)
        req.user = {
            userId: userObject.userId,
            userData: user,
        }
    else {
        req.user!.userId = userObject.userId;
        req.user!.userData = user;
    }

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
        console.error(err);
        return false
    }
}

function collectAuthToken(req: Request): string | undefined | null {
    let authToken = req.headers.authorization || req.cookies.accessToken;
    if (!authToken)
        return undefined

    return req.headers.authorization ? authToken.split(" ")[1] : authToken;
}

export function unAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (authHeader)
        return res.status(401).send();

    next();
}