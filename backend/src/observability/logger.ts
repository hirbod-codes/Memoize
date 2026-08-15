import path from 'node:path';
import pino from 'pino';
import { isProduction, logDir, logLevel, lokiPushUrl, nodeEnv } from '../configs';
import { trace, context } from '@opentelemetry/api';

// Where Pino writes its rotating JSON log file. This is the path Alloy tails
// (see docker-compose / config.alloy) — set it to the SAME absolute path on
// both sides in prod, and to a local ./logs folder in dev.
const logDirectory = logDir ?? path.join(process.cwd(), 'logs');

// Never let these hit disk or stdout in plaintext, no matter how deep they're nested.
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
];

const targets: pino.TransportTargetOptions[] = [
  {
    // Structured JSON, one line per event — this is the file Alloy tails and
    // ships to Loki. Rotates daily or at 50MB, keeps the last 14 files.
    target: 'pino-roll',
    level: logLevel ?? 'info',
    options: {
      file: path.join(logDirectory, 'backend.log'),
      frequency: 'daily',
      size: '50m',
      mkdir: true,
      limit: { count: 14 },
    },
  },
  {
    // Console output. Pretty-printed in dev; raw JSON to stdout in prod so
    // `docker logs` / your platform's log driver still gets something useful
    // without duplicating the pretty-printer's formatting cost.
    target: isProduction ? 'pino/file' : 'pino-pretty',
    level: logLevel ?? 'info',
    options: isProduction
      ? { destination: 1 } // fd 1 = stdout
      : { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
  },
  {
    target: 'pino-loki',
    level: logLevel ?? 'info',
    options: {
      batching: true,
      interval: 5,
      host: lokiPushUrl,
      silenceErrors: false,
      labels: {
        service: 'memoize-backend',
        env: 'development'
      },
    },
  },
];

const transport = pino.transport({ targets: [targets[2]] });
transport.on('error', (err) => {
  console.error('pino transport error:', err);
});

export const logger = pino(
  {
    serializers: { err: pino.stdSerializers.err },
    level: logLevel ?? 'info',
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    base: { service: 'memoize-backend', env: nodeEnv ?? 'development' },
    timestamp: pino.stdTimeFunctions.epochTime, // ms epoch — matches the loki.process timestamp stage
    formatters: {
      level(label) {
        // "level":"info" instead of "level":30 — much nicer to filter on in Loki/Grafana.
        return { level: label };
      },
    },
    // Runs once per log call — adds trace_id/span_id only when a span is
    // actually active (e.g. inside a traced HTTP request), no-ops otherwise.
    mixin() {
      const span = trace.getSpan(context.active());
      if (!span) return {};
      const { traceId, spanId } = span.spanContext();
      return { trace_id: traceId, span_id: spanId };
    },
  },
  transport,
);

export type Logger = typeof logger;
