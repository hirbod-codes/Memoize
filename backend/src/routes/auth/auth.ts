import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { UserRepository } from '../../DB/repositories/UserRepository';
import { auth } from '../../middlewares/auth';
import { getAuthSettings, updateAuthSettings } from './auth_settings';
import { requestOtp, verifyOtp } from './otp_management';
import { rotateRefreshToken, revokeFamily, revokeAllSessions, revokeSessionByTokenId, listSessions } from './session_management';
import { signAccessToken, blacklistAccessToken } from './token_management';
import { otpRequestSchema, adminSettingsSchema, loginSchema, refreshSchema, registerSchema } from './auth.schemas';
import { handleError, clearAuthCookies, issueTokensAndRespond, setAuthCookies, REFRESH_COOKIE_NAME } from './auth.lib';
import { isAdminIfAuthenticated } from '../../middlewares/auth';
import { string } from 'yup';
import { getLogger } from '../../observability/requestContext';

const router = Router();

router.post('/otp/request', async (req: Request, res: Response) => {
    const log = getLogger().child({ module: 'auth', route: 'POST /auth/otp/request' });
    try {
        const { phoneNumber, purpose, locale } = await otpRequestSchema.validate(req.body);
        log.debug({ phoneNumber, purpose, locale }, 'OTP request received');

        const settings = await getAuthSettings();
        const ur = new UserRepository();

        if (purpose === 'register') {
            if (!settings.allowPhoneRegistration) {
                log.info({ phoneNumber }, 'Rejected OTP request: phone registration disabled');
                return res.status(403).json({ status: 'error', error: 'PHONE_REGISTRATION_DISABLED' });
            }

            if (await ur.getByPhoneNumber(phoneNumber)) {
                log.info({ phoneNumber }, 'Rejected OTP request: phone already registered');
                return res.status(409).json({ status: 'error', error: 'PHONE_TAKEN' });
            }
        } else {
            if (!(await ur.getByPhoneNumber(phoneNumber))) {
                log.info({ phoneNumber }, 'Rejected OTP request: no account for phone number');
                return res.status(404).json({ status: 'error', error: 'USER_NOT_FOUND' });
            }
        }

        const result = await requestOtp(phoneNumber, purpose, locale);
        if (result === 'cooldown') {
            log.info({ phoneNumber }, 'Rejected OTP request: cooldown active');
            return res.status(429).json({ status: 'error', error: 'OTP_COOLDOWN' });
        }

        log.info({ phoneNumber, purpose }, 'OTP sent');
        res.json({ status: 'ok', data: { message: 'Code sent' } });
    } catch (err: any) {
        handleError(res, err);
    }
});

router.post('/register', async (req: Request, res: Response) => {
    const log = getLogger().child({ module: 'auth', route: 'POST /auth/register' });
    try {
        const body = await registerSchema.validate(req.body);
        log.debug({ client: body.client, method: body.method, username: body.username }, 'Register request received');

        const settings = await getAuthSettings();
        const ur = new UserRepository();

        if (body.method === 'email') {
            if (!settings.allowEmailRegistration) {
                log.info('Rejected registration: email registration disabled');
                return res.status(403).json({ status: 'error', error: 'EMAIL_REGISTRATION_DISABLED' });
            }

            if (await ur.getByEmail(body.email!)) {
                log.info({ email: body.email }, 'Rejected registration: email already taken');
                return res.status(409).json({ status: 'error', error: 'EMAIL_TAKEN' });
            }

            const passwordHash = await bcrypt.hash(body.password!, 12);

            const created = await ur.create({
                authMethod: 'email',
                role: 'user',
                planTitle: 'free',
                username: body.username,
                email: body.email,
                temporaryAvatar: true,
                password: passwordHash,
            });

            if (!created) {
                log.error({ email: body.email }, 'User creation failed (email)');
                return res.status(500).json({ status: 'error', error: 'CREATE_FAILED' });
            }

            log.info({ userId: created.insertedId.toString() }, 'Registered new user (email)');
            return issueTokensAndRespond(res, created.insertedId.toString(), body.client, req.headers['user-agent']);
        }

        // phone registration
        if (!settings.allowPhoneRegistration) {
            log.info('Rejected registration: phone registration disabled');
            return res.status(403).json({ status: 'error', error: 'PHONE_REGISTRATION_DISABLED' });
        }

        if (await ur.getByPhoneNumber(body.phoneNumber!)) {
            log.info({ phoneNumber: body.phoneNumber }, 'Rejected registration: phone already taken');
            return res.status(409).json({ status: 'error', error: 'PHONE_TAKEN' });
        }

        if (!(await verifyOtp(body.phoneNumber!, body.code!, 'register'))) {
            log.info({ phoneNumber: body.phoneNumber }, 'Rejected registration: invalid OTP code');
            return res.status(400).json({ status: 'error', error: 'INVALID_CODE' });
        }

        const created = await ur.create({
            authMethod: 'phone',
            role: 'user',
            planTitle: 'free',
            username: body.username,
            phoneNumber: body.phoneNumber,
            temporaryAvatar: true,
        });

        if (!created) {
            log.error({ phoneNumber: body.phoneNumber }, 'User creation failed (phone)');
            return res.status(500).json({ status: 'error', error: 'CREATE_FAILED' });
        }

        log.info({ userId: created.insertedId.toString() }, 'Registered new user (phone)');
        return issueTokensAndRespond(res, created.insertedId.toString(), body.client, req.headers['user-agent']);
    } catch (err: any) {
        handleError(res, err);
    }
});

router.post('/login', async (req: Request, res: Response) => {
    const log = getLogger().child({ module: 'auth', route: 'POST /auth/login' });
    try {
        const body = await loginSchema.validate(req.body);
        log.debug({ client: body.client, method: body.method }, 'Login request received');

        const ur = new UserRepository();

        if (body.method === 'email') {
            const user = await ur.getByEmail(body.email!);
            if (!user || !user.email || !user.password) {
                log.info({ email: body.email }, 'Rejected login: no matching account');
                return res.status(401).json({ status: 'error', error: 'INVALID_CREDENTIALS' });
            }

            const match = await bcrypt.compare(body.password!, user.password);
            if (!match) {
                log.info({ userId: user._id!.toString() }, 'Rejected login: password mismatch');
                return res.status(401).json({ status: 'error', error: 'INVALID_CREDENTIALS' });
            }

            log.info({ userId: user._id!.toString() }, 'Login succeeded (email)');
            return issueTokensAndRespond(res, user._id!.toString(), body.client, req.headers['user-agent']);
        }

        const user = await ur.getByPhoneNumber(body.phoneNumber!);
        if (!user) {
            log.info({ phoneNumber: body.phoneNumber }, 'Rejected login: no matching account');
            return res.status(401).json({ status: 'error', error: 'INVALID_CREDENTIALS' });
        }

        if (!(await verifyOtp(body.phoneNumber!, body.code!, 'login'))) {
            log.info({ userId: user._id!.toString() }, 'Rejected login: invalid OTP code');
            return res.status(400).json({ status: 'error', error: 'INVALID_CODE' });
        }

        log.info({ userId: user._id!.toString() }, 'Login succeeded (phone)');
        return issueTokensAndRespond(res, user._id!.toString(), body.client, req.headers['user-agent']);
    } catch (err: any) {
        handleError(res, err);
    }
});

router.post('/refresh', async (req: Request, res: Response) => {
    const log = getLogger().child({ module: 'auth', route: 'POST /auth/refresh' });
    try {
        const body = await refreshSchema.validate(req.body ?? {});

        const oldTokenId = body.refreshToken ?? req.cookies?.[REFRESH_COOKIE_NAME];
        if (!oldTokenId) {
            log.info({ client: body.client }, 'Rejected refresh: no refresh token supplied');
            return res.status(401).json({ status: 'error', error: 'NO_REFRESH_TOKEN' });
        }

        let rotated;
        try {
            rotated = await rotateRefreshToken(oldTokenId);
        } catch {
            log.warn({ client: body.client }, 'Rejected refresh: token invalid, expired, or reused');
            clearAuthCookies(res);
            return res.status(401).json({ status: 'error', error: 'REFRESH_INVALID' });
        }

        const { token: accessToken, exp } = signAccessToken(rotated.userId);
        log.info({ userId: rotated.userId, client: body.client }, 'Refreshed session');

        if (body.client === 'web') {
            setAuthCookies(res, accessToken, rotated.newTokenId, exp - Math.floor(Date.now() / 1000));
            return res.json({ status: 'ok', data: null });
        }

        res.json({ status: 'ok', data: { accessToken, refreshToken: rotated.newTokenId } });
    } catch (err: any) {
        handleError(res, err);
    }
});

router.post('/logout', auth, async (req: Request, res: Response) => {
    const log = getLogger().child({ module: 'auth', route: 'POST /auth/logout' });
    try {
        const payload = req.user as any;
        log.debug({ userId: payload?.userId }, 'Logout request received');
        const tokenId = req.body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE_NAME];

        // NOTE: payload.jti / payload.exp are read here but the `auth`
        // middleware never actually populates them on req.user (it only
        // copies userId/userData) — this branch is effectively always
        // skipped. Logging as-is, not fixing (out of scope for this pass).
        if (payload?.jti && payload?.exp)
            await blacklistAccessToken(payload.jti, payload.exp);

        if (tokenId)
            await revokeSessionByTokenId(tokenId, payload.userId);

        clearAuthCookies(res);
        log.info({ userId: payload?.userId }, 'Logged out');
        res.json({ status: 'ok', data: null });
    } catch (err) {
        handleError(res, err);
    }
});

router.post('/logout-all', auth, async (req: Request, res: Response) => {
    const log = getLogger().child({ module: 'auth', route: 'POST /auth/logout-all' });
    try {
        const payload = req.user as any;
        log.debug({ userId: payload?.userId }, 'Logout-all request received');

        await revokeAllSessions(payload.userId);
        // Same jti/exp caveat as /logout above.
        if (payload?.jti && payload?.exp)
            await blacklistAccessToken(payload.jti, payload.exp);

        clearAuthCookies(res);
        log.info({ userId: payload?.userId }, 'Logged out of all sessions');
        res.json({ status: 'ok', data: null });
    } catch (err) {
        handleError(res, err);
    }
});

router.get('/sessions', auth, async (req: Request, res: Response) => {
    const log = getLogger().child({ module: 'auth', route: 'GET /auth/sessions' });
    try {
        const payload = req.user as any;
        log.debug({ userId: payload.userId }, 'Listing sessions');
        const sessions = await listSessions(payload.userId);
        log.debug({ userId: payload.userId, sessionCount: sessions.length }, 'Sessions listed');
        res.json({ status: 'ok', data: { sessions } });
    } catch (err) {
        handleError(res, err);
    }
});

router.delete('/sessions/:familyId', auth, async (req: Request, res: Response) => {
    const log = getLogger().child({ module: 'auth', route: 'DELETE /auth/sessions/:familyId' });
    try {
        string().required().validate(req.params.familyId)
        const payload = req.user as any;
        log.debug({ userId: payload.userId, familyId: req.params.familyId }, 'Revoking session family');
        await revokeFamily(req.params.familyId.toString(), payload.userId);
        log.info({ userId: payload.userId, familyId: req.params.familyId }, 'Session family revoked');
        res.json({ status: 'ok', data: null });
    } catch (err) {
        handleError(res, err);
    }
});

router.get('/admin/settings', auth, isAdminIfAuthenticated, async (req: Request, res: Response) => {
    const log = getLogger().child({ module: 'auth', route: 'GET /auth/admin/settings' });

    if ((req.user as any)?.userData?.role !== 'admin') {
        log.warn({ userId: (req.user as any)?.userId }, 'Rejected admin settings read: not an admin');
        return res.status(403).json({ status: 'error', error: 'FORBIDDEN' });
    }

    const settings = await getAuthSettings();
    log.debug({ settings }, 'Fetched auth settings');
    res.json({ status: 'ok', data: settings });
});

router.patch('/admin/settings', auth, isAdminIfAuthenticated, async (req: Request, res: Response) => {
    const log = getLogger().child({ module: 'auth', route: 'PATCH /auth/admin/settings' });
    try {
        if ((req.user as any)?.userData?.role !== 'admin') {
            log.warn({ userId: (req.user as any)?.userId }, 'Rejected admin settings update: not an admin');
            return res.status(403).json({ status: 'error', error: 'FORBIDDEN' });
        }

        const patch = await adminSettingsSchema.validate(req.body);
        log.debug({ patch }, 'Updating auth settings');

        const updated = await updateAuthSettings(patch);
        log.info({ updated }, 'Auth settings updated');

        res.json({ status: 'ok', data: updated });
    } catch (err: any) {
        handleError(res, err);
    }
});

export { router as authRoutes }
