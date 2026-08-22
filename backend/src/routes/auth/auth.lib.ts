import { Response } from "express";
import { signAccessToken } from './token_management';
import { ClientType, createSessionFamily } from "./session_management";

export const ACCESS_COOKIE_NAME = 'accessToken'; // matches req.cookies.accessToken already read in auth.ts
export const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export function setAuthCookies(res: Response, accessToken: string, refreshTokenId: string, accessExpSeconds: number) {
    res.cookie(ACCESS_COOKIE_NAME, accessToken, {
        httpOnly: true, secure: true, sameSite: 'strict', maxAge: accessExpSeconds * 1000, path: '/',
    });
    res.cookie(REFRESH_COOKIE_NAME, refreshTokenId, {
        httpOnly: true, secure: true, sameSite: 'strict', maxAge: REFRESH_TTL_SECONDS * 1000, path: '/auth',
    });
}

export function clearAuthCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE_NAME, { path: '/' });
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
}

export async function issueTokensAndRespond(res: Response, userId: string, client: ClientType, userAgent?: string) {
    const { tokenId } = await createSessionFamily({ userId, client, userAgent });
    const { token: accessToken, exp } = signAccessToken(userId);

    if (client === 'web') {
        setAuthCookies(res, accessToken, tokenId, exp - Math.floor(Date.now() / 1000));
        return res.json({ status: 'ok', data: { userId } });
    }

    return res.json({ status: 'ok', data: { userId, accessToken, refreshToken: tokenId } });
}

export function handleError(res: Response, err: any) {
    if (err.name === 'ValidationError')
        try { return res.status(400).json({ status: 'error', error: err.message }); } catch (_) { }
    console.error(err);
    try { return res.status(500).json({ status: 'error', error: 'INTERNAL' }); } catch (_) { }
}