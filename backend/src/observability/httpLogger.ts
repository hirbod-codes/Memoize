import { randomUUID } from 'node:crypto';
import pinoHttp, { ReqId } from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { logger } from './logger';

export const httpLogger = pinoHttp({
  logger,

  // Reuse an inbound x-request-id if a client/proxy already set one (nginx,
  // a mobile client, another service), otherwise mint one. Echoed back on the
  // response so a user's bug report ("it broke at 14:32") maps to one line
  // in Loki via `req.id`.
  genReqId: (req: IncomingMessage, res: ServerResponse) => {
    const existing = req.headers['x-request-id'];
    const id = typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },

  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },

  customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} -> ${res.statusCode} (${err.message})`,

  // Don't let large upload/streaming bodies or full header dumps end up on
  // disk. Keep just enough to correlate a request across log lines.
  serializers: {
    req(req) {
      return { method: req.method, url: req.url, id: req.id };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },

  // Skip noisy, low-value routes so /healthz and /metrics polling doesn't
  // drown out real traffic in Loki.
  autoLogging: {
    ignore: (req) => req.url === '/healthz' || req.url === '/metrics',
  },
});

// Augment Express's Request type so `req.log` and `req.id` are typed
// wherever this middleware is used.
declare module 'http' {
  interface IncomingMessage {
    id: ReqId;
    log: import('pino').Logger;
  }
}
