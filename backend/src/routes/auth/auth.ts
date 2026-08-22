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

const router = Router();

router.post('/otp/request', async (req: Request, res: Response) => {
    try {
        const { phoneNumber, purpose, locale } = await otpRequestSchema.validate(req.body);
        const settings = await getAuthSettings();
        const ur = new UserRepository();

        if (purpose === 'register') {
            if (!settings.allowPhoneRegistration)
                return res.status(403).json({ status: 'error', error: 'PHONE_REGISTRATION_DISABLED' });

            if (await ur.getByPhoneNumber(phoneNumber))
                return res.status(409).json({ status: 'error', error: 'PHONE_TAKEN' });
        } else {
            if (!(await ur.getByPhoneNumber(phoneNumber)))
                return res.status(404).json({ status: 'error', error: 'USER_NOT_FOUND' });
        }

        const result = await requestOtp(phoneNumber, purpose, locale);
        if (result === 'cooldown')
            return res.status(429).json({ status: 'error', error: 'OTP_COOLDOWN' });

        res.json({ status: 'ok', data: { message: 'Code sent' } });
    } catch (err: any) {
        handleError(res, err);
    }
});

router.post('/register', async (req: Request, res: Response) => {
    try {
        const body = await registerSchema.validate(req.body);
        const settings = await getAuthSettings();
        const ur = new UserRepository();

        if (body.method === 'email') {
            if (!settings.allowEmailRegistration)
                return res.status(403).json({ status: 'error', error: 'EMAIL_REGISTRATION_DISABLED' });

            if (await ur.getByEmail(body.email!))
                return res.status(409).json({ status: 'error', error: 'EMAIL_TAKEN' });

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

            if (!created)
                return res.status(500).json({ status: 'error', error: 'CREATE_FAILED' });

            return issueTokensAndRespond(res, created.insertedId.toString(), body.client, req.headers['user-agent']);
        }

        // phone registration
        if (!settings.allowPhoneRegistration)
            return res.status(403).json({ status: 'error', error: 'PHONE_REGISTRATION_DISABLED' });

        if (await ur.getByPhoneNumber(body.phoneNumber!))
            return res.status(409).json({ status: 'error', error: 'PHONE_TAKEN' });

        if (!(await verifyOtp(body.phoneNumber!, body.code!, 'register')))
            return res.status(400).json({ status: 'error', error: 'INVALID_CODE' });

        const created = await ur.create({
            authMethod: 'phone',
            role: 'user',
            planTitle: 'free',
            username: body.username,
            phoneNumber: body.phoneNumber,
            temporaryAvatar: true,
        });

        if (!created)
            return res.status(500).json({ status: 'error', error: 'CREATE_FAILED' });

        return issueTokensAndRespond(res, created.insertedId.toString(), body.client, req.headers['user-agent']);
    } catch (err: any) {
        handleError(res, err);
    }
});

router.post('/login', async (req: Request, res: Response) => {
    try {
        const body = await loginSchema.validate(req.body);
        const ur = new UserRepository();

        if (body.method === 'email') {
            const user = await ur.getByEmail(body.email!);
            if (!user || !user.email || !user.password)
                return res.status(401).json({ status: 'error', error: 'INVALID_CREDENTIALS' });

            const match = await bcrypt.compare(body.password!, user.password);
            if (!match)
                return res.status(401).json({ status: 'error', error: 'INVALID_CREDENTIALS' });

            return issueTokensAndRespond(res, user._id!.toString(), body.client, req.headers['user-agent']);
        }

        const user = await ur.getByPhoneNumber(body.phoneNumber!);
        if (!user)
            return res.status(401).json({ status: 'error', error: 'INVALID_CREDENTIALS' });

        if (!(await verifyOtp(body.phoneNumber!, body.code!, 'login')))
            return res.status(400).json({ status: 'error', error: 'INVALID_CODE' });

        return issueTokensAndRespond(res, user._id!.toString(), body.client, req.headers['user-agent']);
    } catch (err: any) {
        handleError(res, err);
    }
});

router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const body = await refreshSchema.validate(req.body ?? {});

        const oldTokenId = body.refreshToken ?? req.cookies?.[REFRESH_COOKIE_NAME];
        if (!oldTokenId)
            return res.status(401).json({ status: 'error', error: 'NO_REFRESH_TOKEN' });

        let rotated;
        try {
            rotated = await rotateRefreshToken(oldTokenId);
        } catch {
            clearAuthCookies(res);
            return res.status(401).json({ status: 'error', error: 'REFRESH_INVALID' });
        }

        const { token: accessToken, exp } = signAccessToken(rotated.userId);

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
    try {
        const payload = req.user as any;
        const tokenId = req.body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE_NAME];

        if (payload?.jti && payload?.exp)
            await blacklistAccessToken(payload.jti, payload.exp);

        if (tokenId)
            await revokeSessionByTokenId(tokenId, payload.userId);

        clearAuthCookies(res);
        res.json({ status: 'ok', data: null });
    } catch (err) {
        handleError(res, err);
    }
});

router.post('/logout-all', auth, async (req: Request, res: Response) => {
    try {
        const payload = req.user as any;

        await revokeAllSessions(payload.userId);
        if (payload?.jti && payload?.exp)
            await blacklistAccessToken(payload.jti, payload.exp);

        clearAuthCookies(res);
        res.json({ status: 'ok', data: null });
    } catch (err) {
        handleError(res, err);
    }
});

router.get('/sessions', auth, async (req: Request, res: Response) => {
    try {
        const payload = req.user as any;
        const sessions = await listSessions(payload.userId);
        res.json({ status: 'ok', data: { sessions } });
    } catch (err) {
        handleError(res, err);
    }
});

router.delete('/sessions/:familyId', auth, async (req: Request, res: Response) => {
    try {
        string().required().validate(req.params.familyId)
        const payload = req.user as any;
        await revokeFamily(req.params.familyId.toString(), payload.userId);
        res.json({ status: 'ok', data: null });
    } catch (err) {
        handleError(res, err);
    }
});

router.get('/admin/settings', auth, isAdminIfAuthenticated, async (req: Request, res: Response) => {
    if ((req.user as any)?.userData?.role !== 'admin')
        return res.status(403).json({ status: 'error', error: 'FORBIDDEN' });

    res.json({ status: 'ok', data: await getAuthSettings() });
});

router.patch('/admin/settings', auth, isAdminIfAuthenticated, async (req: Request, res: Response) => {
    try {
        if ((req.user as any)?.userData?.role !== 'admin')
            return res.status(403).json({ status: 'error', error: 'FORBIDDEN' });

        const patch = await adminSettingsSchema.validate(req.body);

        const updated = await updateAuthSettings(patch);

        res.json({ status: 'ok', data: updated });
    } catch (err: any) {
        handleError(res, err);
    }
});

export { router as authRoutes }