import jwt from "jsonwebtoken"
import { Request, Response, NextFunction } from "express";
import { accessTokenSecret } from '../configs';
import { UserRepository } from "../DB/repositories/UserRepository";

/**
 * DOES NOT fail for unauthenticated users.
 * 
 * @param req 
 * @param res 
 * @param next 
 * @returns 
 */
export async function isAdmin(req: Request, res: Response, next: NextFunction) {
    console.log('isAdmin middleware');

    const result = authenticateRequest(req)
    if (!result)
        return next();

    try {
        const ur = new UserRepository()
        const u = await ur.get(result as string)
        if (!u || u.role !== 'admin')
            return res.status(403).send();

        next();
    } catch (err) {
        console.error(err);
        return res.status(403).send();
    }
}

export async function authorization(req: Request, res: Response, next: NextFunction) {
    console.log('authorization middleware');

    if (!(req as any).user)
        return res.status(401).send();

    try {
        const ur = new UserRepository()
        const u = await ur.get((req as any).user.userId)
        if (!u || u.username !== 'hirbod') {
            return res.status(403).send();
        }

        next();
    } catch (err) {
        console.error(err);
        return res.status(403).send();
    }
}

export function auth(req: Request, res: Response, next: NextFunction) {
    console.log('auth middleware');

    const result = authenticateRequest(req)

    if (!result)
        return res.status(401).send();

    (req as any).user = result;
    next();
}

/**
 * @param req
 * @returns user id in a string or a jwt.JwtPayload
 */
export function authenticateRequest(req: Request): string | false | Response<any, Record<string, any>> | jwt.JwtPayload {
    console.log('authenticateRequest');

    const authToken = collectAuthToken(req)
    if (!authToken)
        return false

    return authenticateToken(authToken);
}

/**
 * 
 * @param token The JWT access token
 * @returns user id in a string or a jwt.JwtPayload
 */
export function authenticateToken(token: string): string | false | jwt.JwtPayload {
    console.log('authenticateToken');

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
    console.log('collectAuthToken');

    let authToken = req.headers.authorization || req.cookies.accessToken;
    if (!authToken)
        return undefined

    return req.headers.authorization ? authToken.split(" ")[1] : authToken;
}

export function unAuth(req: Request, res: Response, next: NextFunction) {
    console.log('unAuth middleware');
    const authHeader = req.headers.authorization;

    if (authHeader)
        return res.status(401).send();

    next();
}