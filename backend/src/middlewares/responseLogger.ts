import { Request, Response, NextFunction } from "express";

export function jsonResponseLogger(req: Request, res: Response, next: NextFunction) {
    console.log({ cookies: JSON.stringify(req.cookies) })
    const start = Date.now();

    let responseBody: any;

    // Patch res.send
    const originalSend = res.send;
    res.send = function (body: any) {
        responseBody = body;
        return originalSend.call(this, body);
    };

    // Patch res.json
    const originalJson = res.json;
    res.json = function (body: any) {
        responseBody = body;
        return originalJson.call(this, body);
    };

    res.on("finish", () => {
        const duration = Date.now() - start;

        const type = res.getHeader("content-type");
        console.log(`-------------------------------Json response logger------------------------------- ${req.method} ${res.statusCode} ${req.originalUrl}\n`, {
            ips: req.ips,
            ip: req.ip,
            contentType: type,
            duration: `${duration}ms`,
            body: responseBody,
        });
    });

    next();
}

export function streamResponseLogger(req: Request, res: Response, next: NextFunction) {
    const type = res.getHeader("content-type");

    if (typeof type === "string" && type.includes("application/json")) {
        return;
    }

    const start = Date.now();

    let totalSize = 0
    let chunks: Buffer[] = [];

    let isJson = false;
    const originalJson = res.json;
    const originalWrite = res.write;
    const originalEnd = res.end;
    const originalSend = res.send;

    res.json = function (body: any) {
        isJson = true;
        return originalJson.call(this, body);
    };

    res.send = function (body: any) {
        if (typeof body === "object" && body !== null) {
            isJson = true;
        }
        return originalSend.call(this, body);
    };

    res.write = function (chunk: any, encodingOrCb?: BufferEncoding | ((error?: Error | null) => void), cb?: (error?: Error | null) => void): boolean {
        let encoding: BufferEncoding | undefined;
        let callback: ((error?: Error | null) => void) | undefined;

        if (typeof encodingOrCb === "function") {
            callback = encodingOrCb;
            encoding = undefined;
        } else {
            encoding = encodingOrCb;
            callback = cb;
        }

        totalSize += Buffer.isBuffer(chunk)
            ? chunk.length
            : Buffer.byteLength(chunk, encoding);

        if (encoding)
            return originalWrite.call(this, chunk, encoding, callback);
        else
            return originalWrite.call(this, chunk, callback as any);
    };

    res.end = function (chunk?: any, encodingOrCb?: BufferEncoding | (() => void), cb?: () => void): Response {
        let encoding: BufferEncoding | undefined;
        let callback: (() => void) | undefined;

        if (typeof encodingOrCb === "function") {
            callback = encodingOrCb;
            encoding = undefined;
        } else {
            encoding = encodingOrCb;
            callback = cb;
        }

        if (chunk) {
            totalSize += Buffer.isBuffer(chunk)
                ? chunk.length
                : Buffer.byteLength(chunk, encoding);
        }

        req.on('finish', () => {
            if (isJson) return;

            const duration = Date.now() - start;
            console.log(`-------------------------------Stream response logger------------------------------- ${req.method} ${res.statusCode} ${req.originalUrl}\n`, {
                ips: req.ips,
                ip: req.ip,
                contentType: type,
                size: totalSize,
                duration: `${duration}ms`,
            });
        })

        if (encoding)
            return originalEnd.call(this, chunk, encoding, callback);
        else
            return originalEnd.call(this, chunk, callback as any);
    };

    next();
}