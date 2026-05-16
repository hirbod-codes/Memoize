import jwt from "jsonwebtoken"
import { Request, Response, NextFunction } from "express";
import { accessTokenSecret } from "..";
import { UserRepository } from "../DB/repositories/UserRepository";

export async function authorization(req: Request, res: Response, next: NextFunction) {
    console.log('authorization middleware');

    if (!(req as any).user) {
        return res.status(401).send();
    }

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

    let authToken = req.headers.authorization || req.cookies.accessToken;

    if (!authToken)
        return res.status(401).send();

    authToken = req.headers.authorization ? authToken.split(" ")[1] : authToken;

    try {
        const decoded = jwt.verify(authToken, accessTokenSecret);
        (req as any).user = decoded;
        next();
    } catch (err) {
        console.error(err);
        return res.status(401).send();
    }
}

export function unAuth(req: Request, res: Response, next: NextFunction) {
    console.log('unAuth middleware');
    const authHeader = req.headers.authorization;

    if (authHeader)
        return res.status(401).send();

    next();
}