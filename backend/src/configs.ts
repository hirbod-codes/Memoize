import dotenv from 'dotenv';
import { getStringEnv, getIntegerEnv, getBooleanEnv } from './utils';

dotenv.config({ debug: process.env.DEBUG !== undefined ? Boolean(process.env.DEBUG) : undefined });

// prefix and suffix is only used for reading secret files in resolveRawEnv function in utils.ts
export const envPrefix = process.env['ENV_PREFIX'] ?? '';
export const envSuffix = process.env['ENV_SUFFIX'] ?? '';

export const nodeEnv = getStringEnv('NODE_ENV', 'The Node env environment variable is not provided');
export const isProduction = nodeEnv! === 'production';

export const logDir = getStringEnv('LOG_DIR', 'The LOG_DIR environment variable is not provided');
export const logLevel = getStringEnv('LOG_LEVEL', 'The LOG_LEVEL environment variable is not provided');

/** 
 * Alloy's OTLP HTTP receiver — see config.alloy's otelcol.receiver.otlp block. 
 * Backend and alloy must share a Docker network (backend_net).
*/
export const otelExporterOtlpEndpoint = getStringEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'The Otel exporter otlp endpoint environment variable is not provided');
export const lokiPushUrl = getStringEnv('LOKI_PUSH_URL', 'The Loki push url environment variable is not provided');
export const pushgatewayUrl = getStringEnv('PUSHGATEWAY_URL', 'The Pushgateway url environment variable is not provided');

export const hostName = getStringEnv('HOST', 'The HOST environment variable is not provided');
export const hostPort = getIntegerEnv('PORT', 'The PORT environment variable is not provided', (s) => s.min(1025));

export const allowedOrigins = getStringEnv('ALLOWED_ORIGINS', 'The Allowed origins environment variable is not provided')!;

export const ttsApiKey = getStringEnv('TTS_API_KEY', 'The TTS API key environment variable is not provided', s => s.optional())!;

export const accessTokenSecret = getStringEnv('ACCESS_TOKEN_SECRET', 'The access token secret environment variable is not provided');
export const refreshTokenSecret = getStringEnv('REFRESH_TOKEN_SECRET', 'The refresh token secret environment variable is not provided');

export const streamSigningSecret = getStringEnv('STREAM_SIGNING_SECRET', 'The stream signing secret environment variable is not provided');

export const meilisearchKey = getStringEnv('MEILISEARCH_KEY', 'The Meilisearch key environment variable is not provided')!;
export const meilisearchHost = getStringEnv('MEILISEARCH_HOST', 'The Meilisearch host environment variable is not provided')!;
export const meilisearchPort = getIntegerEnv('MEILISEARCH_PORT', 'The Meilisearch port environment variable is not provided')!;

export const BUCKET_NAME = getStringEnv('BUCKET_NAME', 'The Bucket name environment variable is not provided')!;
export const s3Endpoint = getStringEnv('S3_STORAGE_ENDPOINT', 'The S3 storage endpoint environment variable is not provided')!;
export const s3AccessKey = getStringEnv('S3_STORAGE_ACCESS_KEY', 'The S3 storage access key environment variable is not provided')!;
export const s3SecretKey = getStringEnv('S3_STORAGE_SECRET_KEY', 'The S3 storage secret key environment variable is not provided')!;

export const redisConfig = {
    host: getStringEnv('REDIS_HOST', 'The Redis host environment variable is not provided'),
    port: getIntegerEnv('REDIS_PORT', 'The Redis port environment variable is not provided'),
    databaseIndex: getIntegerEnv('REDIS_DATABASE_INDEX', 'The Db database name environment variable is not provided'),
    supportsTransaction: getBooleanEnv('REDIS_SUPPORTS_TRANSACTION', 'The Db supports transaction environment variable is not provided'),
    // url: getStringEnv('REDIS_URL', 'The Db url environment variable is not provided'),
    auth: {
        // username: getStringEnv('REDIS_USERNAME', 'The Mongodb username environment variable is not provided'),
        password: getStringEnv('REDIS_PASSWORD', 'The Mongodb password environment variable is not provided'),
    }
};

export const dbConfig = {
    databaseName: getStringEnv('DB_DATABASE_NAME', 'The Db database name environment variable is not provided'),
    supportsTransaction: getBooleanEnv('DB_SUPPORTS_TRANSACTION', 'The Db supports transaction environment variable is not provided'),
    url: getStringEnv('DB_URL', 'The Db url environment variable is not provided'),
    auth: {
        username: getStringEnv('MONGODB_USERNAME', 'The Mongodb username environment variable is not provided'),
        password: getStringEnv('MONGODB_PASSWORD', 'The Mongodb password environment variable is not provided'),
    }
};
