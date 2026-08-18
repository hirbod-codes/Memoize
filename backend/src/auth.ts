import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken"
import { accessTokenSecret, refreshTokenSecret } from './configs';
import { getLogger } from "./observability/requestContext";

export type Payload = {
    userId: string
    username?: string
};

export class Auth {
    private static SALT_ROUNDS = 12;

    async hashPassword(password: string) {
        try {
            return await bcrypt.hash(password, Auth.SALT_ROUNDS);
        } catch (err) {
            getLogger().error({ password, err }, 'System failed to hash password.')
            return false
        }
    }

    async hashRefreshToken(refreshToken: string) {
        try {
            return bcrypt.hash(refreshToken, 10);
        } catch (err) {
            getLogger().error({ refreshToken, err }, 'System failed to hash Refresh Token.')
            return false
        }
    }

    async verifyPassword(password: string, hash: string) {
        return await bcrypt.compare(password, hash);
    }

    async verifyRefreshTokenHash(token: string, hash: string) {
        return bcrypt.compare(token, hash);
    }

    verifyRefreshTokenByJwt(refreshToken: string): string | JwtPayload | false {
        try {
            return jwt.verify(refreshToken, refreshTokenSecret);
        } catch (err) {
            getLogger().error({ refreshToken, err }, 'System failed to verify refresh token.')
            return false
        }
    }

    verifyAccessTokenByJwt(accessToken: string): string | JwtPayload | false {
        try {
            return jwt.verify(accessToken, accessTokenSecret);
        } catch (err) {
            getLogger().error({ accessToken, err }, 'System failed to verify access token.')
            return false
        }
    }

    generateAccessToken(payload: Payload) {
        return jwt.sign(payload, accessTokenSecret, {
            expiresIn: "360m",
        });
    }

    generateRefreshToken(payload: Payload) {
        return jwt.sign(payload, refreshTokenSecret, {
            expiresIn: "7d",
        });
    }

    generateTokens(payload: Payload) {
        try {
            const accessToken = this.generateAccessToken(payload);
            const refreshToken = this.generateRefreshToken(payload);

            return { accessToken, refreshToken };
        } catch (err) {
            getLogger().error({ payload, err }, 'System failed to generate token.')
            return false
        }
    }

    async login(hashedPassword: string, password: string, payload: Payload) {
        try {
            const valid = await this.verifyPassword(password, hashedPassword);
            if (!valid)
                throw new Error("Invalid credentials");

            return this.generateAccessToken(payload);
        } catch (err) {
            getLogger().error({ hashedPassword, password, payload, err }, 'System failed to verify password and generate access token.')
            return false
        }
    }
}