import { AsyncLocalStorage } from 'node:async_hooks';
import { logger as baseLogger, Logger } from './logger';

const als = new AsyncLocalStorage<Logger>();

export function setRequestLogger(log: Logger) {
    als.enterWith(log);
}

export function getLogger(): Logger {
    return als.getStore() ?? baseLogger;
}