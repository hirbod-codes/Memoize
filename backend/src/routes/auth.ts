import express from 'express';
import { string } from 'yup';
import { authRateLimiter } from '../middlewares/rateLimiting';
import { UserRepository } from '../DB/repositories/UserRepository';
import { User } from '../DB/models/User';
import { Auth, Payload } from '../auth';
import { InvalidTokensRepository } from '../DB/repositories/InvalidTokensRepository';
import { auth, unAuth } from '../middlewares/auth';
import { accessTokenSecret } from '..';
import jwt from 'jsonwebtoken'

const router = express.Router();

router.get('/hasRefreshToken', authRateLimiter, async (req, res) => {
    try {
        console.log('/api/auth/hasRefreshToken')

        const refreshToken = req.cookies.refreshToken
        console.log({ refreshToken })

        try {
            const auth = new Auth()

            const decoded = auth.verifyRefreshTokenByJwt(refreshToken)
            console.log({ decoded })

            if (decoded === false)
                res.status(401).send()
            else
                res.status(200).send()
        } catch (err) {
            console.error(err);

            res.status(401).send()
        }
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

router.get('/hasAccessToken', authRateLimiter, async (req, res) => {
    try {
        console.log('/api/auth/hasAccessToken')

        const accessToken = req.cookies.accessToken
        console.log({ accessToken })

        try {
            const auth = new Auth()

            const decoded = auth.verifyRefreshTokenByJwt(accessToken)
            console.log({ decoded })

            if (decoded === false)
                res.status(401).send()
            else
                res.status(200).send()
        } catch (err) {
            console.error(err)
            res.status(401).send()
        }
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

router.get('/existence', unAuth, authRateLimiter, async (req, res) => {
    try {
        console.log('/api/auth/existence')

        const userRepository = new UserRepository()

        console.log('Validation...')
        let username: string | undefined = undefined, email: string | undefined = undefined, phoneNumber: string | undefined = undefined
        try {
            username = req.query.username?.toString()
            email = req.query.email?.toString()
            phoneNumber = req.query.phoneNumber?.toString()

            if (username && !string().optional().min(2).isValidSync(username)) {
                res.status(400).json({ message: 'Invalid username' })
                return
            }

            if (email && !string().optional().email().isValidSync(email)) {
                res.status(400).json({ message: 'Invalid email' })
                return
            }

            if (phoneNumber && !string().optional().isValidSync(phoneNumber)) {
                res.status(400).json({ message: 'Invalid phoneNumber' })
                return
            }

            if (!username && !email && !phoneNumber) {
                res.status(400).json({ message: 'Invalid password' })
                return
            }
        } catch (err) {
            console.log(err)
            res.status(400).send()
            return
        }

        console.log('Fetching user...')
        let user: User | false
        if (username)
            user = await userRepository.getByUsername(username)
        else if (email)
            user = await userRepository.getByEmail(email)
        else
            user = await userRepository.getByPhoneNumber(phoneNumber!)
        if (user === false) {
            res.status(500).send()
            return
        }

        if (user)
            res.status(200).json({ found: true })
        else
            res.status(200).json({ found: false })

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

router.post('/register', unAuth, authRateLimiter, async (req, res) => {
    try {
        console.log('/api/auth/register')

        const auth = new Auth
        const userRepository = new UserRepository()

        console.log('Validation...')
        let username: string | undefined = undefined, email: string | undefined = undefined, phoneNumber: string | undefined = undefined, password: string | undefined = undefined
        try {
            username = req.body?.username?.toString()
            email = req.body?.email?.toString()
            phoneNumber = req.body?.phoneNumber?.toString()
            password = req.body?.password?.toString()
            console.log({ username, email, phoneNumber, password })

            if (username && !string().optional().min(2).isValidSync(username)) {
                res.status(400).json({ message: 'Invalid username' })
                return
            }

            if (email && !string().optional().email().isValidSync(email)) {
                res.status(400).json({ message: 'Invalid email' })
                return
            }

            if (phoneNumber && !string().optional().isValidSync(phoneNumber)) {
                res.status(400).json({ message: 'Invalid phoneNumber' })
                return
            }

            if (!string().required().min(6).isValidSync(password)) {
                res.status(400).json({ message: 'Invalid password' })
                return
            }

            if (!username && !email && !phoneNumber) {
                res.status(400).json({ message: 'Invalid password' })
                return
            }
        } catch (err) {
            console.log(err)
            res.status(400).send()
            return
        }

        console.log('Hashing password...')
        const hashedPassword = await auth.hashPassword(password)
        if (hashedPassword === false) {
            res.status(500).send()
            return
        }

        console.log('Creating user...')
        const createResult = await userRepository.create({
            username,
            email,
            phoneNumber,
            password: hashedPassword,
            role: 'default',
            playlists: []
        })
        if (createResult === false || !createResult.acknowledged) {
            res.status(500).send()
            return
        }
        console.log({ createResult })

        console.log('Generating tokens...')
        const result = auth.generateTokens({ userId: createResult.insertedId.toString(), username })
        if (result === false) {
            res.status(401).send()
            return
        }
        console.log({ result })

        console.log('Hashing refresh token...')
        const hashedRefreshToken = await auth.hashRefreshToken(result.refreshToken)
        if (hashedRefreshToken === false) {
            res.status(500).send()
            return
        }

        const updateResult = await userRepository.updateRefreshToken(createResult.insertedId.toString(), hashedRefreshToken)
        if (updateResult === false) {
            res.status(500).send()
            return
        }
        console.log({ updateResult })

        console.log('Storing new tokens in cookie...')
        res.cookie("refreshToken", result.refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.cookie("accessToken", result.accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: '/',
            maxAge: 1 * 60 * 60 * 1000,
        });

        res.status(200).json({ accessToken: result.accessToken })

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

router.post('/login', unAuth, authRateLimiter, async (req, res) => {
    try {
        console.log('/api/auth/login')

        console.log('Validation...')
        let username: string | undefined = undefined, email: string | undefined = undefined, phoneNumber: string | undefined = undefined, password: string | undefined = undefined
        try {
            const identifier = req.body?.identifier?.toString()
            password = req.body?.password?.toString()
            console.log({ identifier, password })

            if (!string().required().isValidSync(identifier)) {
                res.status(400).json({ message: 'Invalid credentials' })
                return
            }

            if (!string().required().email().isValidSync(identifier))
                if (!string().required().matches(/[0-9]{11}/).isValidSync(identifier))
                    username = identifier
                else
                    phoneNumber = identifier
            else
                email = identifier

            if (!string().required().min(6).isValidSync(password)) {
                res.status(400).json({ message: 'Invalid credentials' })
                return
            }

            if (!username && !email && !phoneNumber) {
                res.status(400).json({ message: 'Invalid credentials' })
                return
            }
        } catch (err) {
            console.log(err)
            res.status(400).json({ message: 'Invalid credentials' })
            return
        }
        console.log({ username, email, phoneNumber, password })

        console.log('Fetching user...')
        const userRepository = new UserRepository()
        let user: User | false = false
        if (username)
            user = await userRepository.getByUsername(username)
        if (email)
            user = await userRepository.getByEmail(email)
        if (phoneNumber)
            user = await userRepository.getByPhoneNumber(phoneNumber)
        if (user === false || !user || !user._id) {
            res.status(400).send()
            return
        }

        const payload = { userId: user._id.toString(), username: user.username }

        console.log('Authenticating...')
        const auth = new Auth()
        const accessToken = await auth.login(user.password, password, payload)
        if (accessToken === false)
            return res.status(400).send()

        let refreshToken
        if (!user.refreshToken || auth.verifyRefreshTokenByJwt(user.refreshToken) === false) {
            console.log('Refresh token not found...')

            console.log('Generate new refresh token...')
            refreshToken = auth.generateRefreshToken(payload)

            console.log('Hashing the new refresh token...')
            const hashedRefreshToken = await auth.hashRefreshToken(refreshToken)
            if (hashedRefreshToken === false)
                return res.status(500).send()

            const updateDbRefreshTokenResult = await userRepository.updateRefreshToken(user._id.toString(), hashedRefreshToken)
            console.log({ updateDbRefreshTokenResult })
            if (updateDbRefreshTokenResult === false || !updateDbRefreshTokenResult.acknowledged)
                return res.status(500).send()
        } else
            refreshToken = user.refreshToken

        console.log('Storing new tokens in cookie...')
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: '/',
            maxAge: 1 * 60 * 60 * 1000,
        });

        res.status(200).json({ accessToken })

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

router.post('/refresh', async (req, res) => {
    try {
        console.log('/api/auth/refresh')

        const auth = new Auth()
        const userRepository = new UserRepository()

        console.log('Validation...')
        let refreshToken: string | undefined = undefined, userId: string | undefined = undefined, username: string | undefined = undefined
        try {
            refreshToken = req.cookies.refreshToken;
            console.log({ refreshToken })

            if (!string().required().isValidSync(refreshToken)) {
                res.status(400).json({ message: 'invalid refresh token' })
                return
            }

            const result = auth.verifyRefreshTokenByJwt(refreshToken)
            if (result === false || typeof result === 'string') {
                res.status(400).json({ message: 'invalid refresh token' })
                return
            }
            console.log({ jwtVerificationResult: result })

            const user = await userRepository.get((result as Payload).userId)
            if (user === false || !user || !user.refreshToken) {
                res.status(400).json({ message: 'invalid refresh token' })
                return
            }
            userId = user._id.toString()
            username = user.username
            console.log({ userId, username })

            const isValid = await auth.verifyRefreshTokenHash(refreshToken, user.refreshToken);
            if (!isValid) {
                res.status(400).json({ message: 'invalid refresh token' })
                return
            }
        } catch (err) {
            console.log(err)
            res.status(400).send()
            return
        }

        console.log('Generating tokens...')
        const accessToken = auth.generateAccessToken({ userId, username })
        console.log({ accessToken })

        console.log('Storing new access token in cookie...')
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: '/',
            maxAge: 1 * 60 * 60 * 1000,
        });

        res.status(200).json({ accessToken })

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

router.post('/logout', authRateLimiter, async (req, res) => {
    try {
        console.log('/api/auth/logout')

        const userRepository = new UserRepository()

        console.log('Validations...')
        let refreshToken: string | undefined = undefined, accessToken: string | undefined = undefined
        try {
            refreshToken = req.cookies.refreshToken;
            accessToken = req.cookies.accessToken;
            console.log({ refreshToken, accessToken })

            if (!string().required().isValidSync(refreshToken)) {
                res.status(401).json({ message: 'invalid refresh token' })
                return
            }

            if (!string().optional().isValidSync(accessToken)) {
                res.status(401).json({ message: 'invalid refresh token' })
                return
            }

            if (!accessToken && !refreshToken)
                return res.status(401).json({ message: 'invalid tokens' })
        } catch (err) {
            console.log(err)
            res.status(401).send()
            return
        }

        const decoded = jwt.verify(accessToken ?? refreshToken, accessTokenSecret);

        const updateResult = await userRepository.updateRefreshToken((decoded as any).userId, '')
        console.log({ updateResult })
        if (updateResult === false || !updateResult.acknowledged) {
            res.status(500).send()
            return
        }

        const invalidTokensRepository = new InvalidTokensRepository()

        if (refreshToken) {
            const invalidationResult = await invalidTokensRepository.create(refreshToken)
            console.log({ invalidationResult })
            if (invalidationResult === false || !invalidationResult.acknowledged) {
                res.status(500).send()
                return
            }
        }

        if (accessToken) {
            const invalidationResult = await invalidTokensRepository.create(accessToken)
            console.log({ invalidationResult })
            if (invalidationResult === false || !invalidationResult.acknowledged) {
                res.status(500).send()
                return
            }
        }

        console.log('Clearing tokens in cookie...')
        res.clearCookie('refreshToken')
        res.clearCookie('accessToken')

        res.status(200).send();

        console.log('------------end------------')
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
})

export { router as authRoutes };
