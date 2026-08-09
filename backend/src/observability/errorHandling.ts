import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger';

/**
 * Call once at startup, before you start listening. Without this, an
 * uncaught exception in a stream callback or ffmpeg child-process handler
 * goes straight to unstructured stderr — invisible to Loki, and the process
 * may be left in a half-dead state instead of exiting cleanly.
 */
export function registerProcessErrorHandlers(): void {
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception — exiting');
    // Give the logger a moment to flush the transport before exiting.
    setTimeout(() => process.exit(1), 100);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandled promise rejection');
  });
}

/**
 * Express error-handling middleware — mount LAST, after all routes.
 * Logs the full error (with stack, via pino's err serializer) tagged with
 * the request ID, and never leaks internals to the client.
 */
export function errorLoggingMiddleware() {
  return (err: Error, req: Request, res: Response, _next: NextFunction) => {
    req.log?.error({ err }, 'unhandled request error') ?? logger.error({ err }, 'unhandled request error');
    if (res.headersSent) return;
    res.status(500).json({ error: 'internal_server_error', requestId: req.id });
  };
}
