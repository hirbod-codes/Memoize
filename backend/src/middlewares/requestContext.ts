import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

interface RequestContext {
    requestId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Mount this FIRST, before pino-http and before your routes.
 * It lets any code — deep in a service, a stream callback, a queue
 * consumer triggered by this request — look up the current request's
 * correlation ID without threading it through every function signature.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
    const incomingId = req.headers['x-request-id'];
    const requestId = (typeof incomingId === 'string' && incomingId) || randomUUID();

    res.setHeader('x-request-id', requestId);

    asyncLocalStorage.run({ requestId }, () => {
        next();
    });
}

export function getRequestId(): string | undefined {
    return asyncLocalStorage.getStore()?.requestId;
}