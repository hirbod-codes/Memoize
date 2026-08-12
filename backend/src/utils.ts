import { boolean, BooleanSchema, number, NumberSchema, string, StringSchema } from "yup";
import http, { IncomingMessage } from "http";
import https from "https";
import fs from "fs";
import path from "path";
import os from "os";
import { envPrefix, envSuffix } from ".";

const SECRETS_DIR = process.env.SECRETS_DIR ?? '/run/secrets'

function readSecretFile(key: string): string | undefined {
    if (os.platform() !== 'linux')
        return undefined

    const secretPath = path.join(SECRETS_DIR, key)

    try {
        const contents = fs.readFileSync(secretPath, 'utf8').trim()
        return contents.length > 0 ? contents : undefined
    } catch (e: any) {
        if (e?.code !== 'ENOENT')
            console.warn(`Found ${secretPath} but couldn't read it: ${e?.message ?? e}`)
        return undefined
    }
}

function resolveRawEnv(key: string): string | undefined {
    return readSecretFile(`${envPrefix}${key}${envSuffix}`) ?? process.env[key]
}

export function validateBooleanEnv(env?: boolean, message?: string, validate?: (schema: BooleanSchema) => BooleanSchema, manuallyValidate?: (env?: boolean) => boolean) {
    let schema: any = boolean().required()

    if (validate)
        schema = validate(schema)

    if (!schema.isValidSync(env))
        throw new Error(message ?? 'Invalid environment variable provided')

    if (manuallyValidate !== undefined && manuallyValidate(env) === false)
        throw new Error(message ?? 'Invalid environment variable provided')
}

export function validateStringEnv(env?: string, message?: string, validate?: (schema: StringSchema) => StringSchema, manuallyValidate?: (env?: string) => boolean) {
    let schema: any = string().required()

    if (validate)
        schema = validate(schema)

    if (!schema.isValidSync(env))
        throw new Error(message ?? 'Invalid environment variable provided')

    if (manuallyValidate !== undefined && manuallyValidate(env) === false)
        throw new Error(message ?? 'Invalid environment variable provided')
}

export function validateIntegerEnv(env?: number, message?: string, validate?: (schema: NumberSchema) => NumberSchema, manuallyValidate?: (env?: number) => boolean) {
    let schema: any = number().required()

    if (validate)
        schema = validate(schema)

    if (!schema.isValidSync(env) || !Number.isFinite(env) || !Number.isInteger(env))
        throw new Error(message ?? 'Invalid environment variable provided')

    if (manuallyValidate !== undefined && manuallyValidate(env) === false)
        throw new Error(message ?? 'Invalid environment variable provided')
}

export function getStringEnv(key: string, message?: string, validate?: (schema: StringSchema) => StringSchema, manuallyValidate?: (env?: string) => boolean): string {
    const env = resolveRawEnv(key)

    console.log(`${key}: ${env !== undefined ? '<*****>' : '<missing>'}`)

    validateStringEnv(env, message, validate, manuallyValidate)

    return env!
}

export function getIntegerEnv(key: string, message?: string, validate?: (schema: NumberSchema) => NumberSchema, manuallyValidate?: (env?: number) => boolean): number {
    const raw = resolveRawEnv(key)
    const env = Number(raw)

    console.log(`${key}: ${raw !== undefined ? '<*****>' : '<missing>'}`)

    validateIntegerEnv(env, message, validate, manuallyValidate)

    return env!
}

export function getBooleanEnv(key: string, message?: string, validate?: (schema: BooleanSchema) => BooleanSchema, manuallyValidate?: (env?: boolean) => boolean): boolean {
    const raw = resolveRawEnv(key)
    const env = raw?.toLowerCase() === 'true'

    console.log(`${key}: ${raw !== undefined ? '<*****>' : '<missing>'}`)

    validateBooleanEnv(env, message, validate, manuallyValidate)

    return env!
}

export async function httpRequest(options: http.RequestOptions, sendData?: string): Promise<{ response: http.IncomingMessage, data: string }> {
    return new Promise<{ response: http.IncomingMessage, data: string }>((resolve, reject) => {
        const request = http.request(options, (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                resolve({ response, data })
            });

            response.on('error', (e) => {
                console.error(e)
                reject(e)
            });
        });

        request.on('error', (e) => {
            console.error(e)
            reject(e)
        });

        if (sendData)
            request.write(sendData);

        request.end();
    })
}

export async function httpsStreamRequest(options: https.RequestOptions, sendData?: string): Promise<IncomingMessage> {
    return new Promise<IncomingMessage>((resolve, reject) => {
        const request = https.request(options, (response) => {
            resolve(response);
        });

        request.on('error', (e) => {
            console.error(e)
            reject(e)
        });

        if (sendData)
            request.write(sendData);

        request.end();
    })
}

export async function httpsRequest(options: https.RequestOptions, sendData?: string): Promise<{ response: http.IncomingMessage, data: string }> {
    return new Promise<{ response: http.IncomingMessage, data: string }>((resolve, reject) => {
        const request = https.request(options, (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                resolve({ response, data })
            });

            response.on('error', (e) => {
                console.error(e)
                reject(e)
            });
        });

        request.on('error', (e) => {
            console.error(e)
            reject(e)
        });

        if (sendData)
            request.write(sendData);

        request.end();
    })
}

export async function tryAndWait(callback: CallableFunction, secondsToWait: number = 5, maxAttempts: number = 100): Promise<boolean> {
    let attempts = 0

    while (attempts <= maxAttempts) {
        attempts += 1
        console.log('safety', attempts)
        try {
            await callback()
            return true
        }
        catch (e) {
            console.error(e)

            await (() => new Promise<void>((res, rej) => {
                console.log('waiting for 5 seconds...')
                setTimeout(() => { res() }, secondsToWait * 1000)
            }))()
        }
    }

    if (attempts > 100) {
        console.log('safety reached!!')
        return false
    }

    return true
}

export function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });
}