import bcrypt from "bcrypt";
import { User } from "./DB/models/User";
import jwt, { JwtPayload } from "jsonwebtoken"
import { accessTokenSecret, refreshTokenSecret } from ".";

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
            console.error(err)
            return false
        }
    }

    async hashRefreshToken(refreshToken: string) {
        try {
            return bcrypt.hash(refreshToken, 10);
        } catch (err) {
            console.error(err)
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
            console.error(err)
            return false
        }
    }

    verifyAccessTokenByJwt(accessToken: string): string | JwtPayload | false {
        try {
            return jwt.verify(accessToken, accessTokenSecret);
        } catch (err) {
            console.error(err)
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
            console.error(err)
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
            console.error(err)
            return false
        }
    }
}