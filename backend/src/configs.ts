import dotenv from 'dotenv';
import { getStringEnv, getIntegerEnv, getBooleanEnv } from './utils';

dotenv.config({ debug: process.env.DEBUG !== undefined ? Boolean(process.env.DEBUG) : undefined });

// prefix and suffix is only used for reading secret files in resolveRawEnv function in utils.ts
export const envPrefix = process.env['ENV_PREFIX'] ?? '';
export const envSuffix = process.env['ENV_SUFFIX'] ?? '';

export const nodeEnv = getStringEnv('NODE_ENV', 'The NODE_ENV environment variable is not provided');
export const isProduction = nodeEnv! === 'production';

export const logDir = getStringEnv('LOG_DIR', 'The LOG_DIR environment variable is not provided');
export const logLevel = getStringEnv('LOG_LEVEL', 'The LOG_LEVEL environment variable is not provided');

export const videoUploadTmpDir = getStringEnv('VIDEO_UPLOAD_TMP_DIR', 'The VIDEO_UPLOAD_TMP_DIR environment variable is not provided');
export const audioUploadTmpDir = getStringEnv('AUDIO_UPLOAD_TMP_DIR', 'The AUDIO_UPLOAD_TMP_DIR environment variable is not provided');
export const imageUploadTmpDir = getStringEnv('IMAGE_UPLOAD_TMP_DIR', 'The IMAGE_UPLOAD_TMP_DIR environment variable is not provided');

/** 
 * Alloy's OTLP HTTP receiver — see config.alloy's otelcol.receiver.otlp block. 
 * Backend and alloy must share a Docker network (backend_net).
*/
export const otelExporterOtlpEndpoint = getStringEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'The Otel exporter otlp endpoint environment variable is not provided');
export const lokiPushUrl = getStringEnv('LOKI_PUSH_URL', 'The LOKI_PUSH_URL environment variable is not provided');
export const pushgatewayUrl = getStringEnv('PUSHGATEWAY_URL', 'The PUSHGATEWAY_URL environment variable is not provided');

export const hostName = getStringEnv('HOST', 'The HOST environment variable is not provided');
export const hostPort = getIntegerEnv('PORT', 'The PORT environment variable is not provided', (s) => s.min(1025));

export const allowedOrigins = getStringEnv('ALLOWED_ORIGINS', 'The ALLOWED_ORIGINS environment variable is not provided')!;

export const ttsApiKey = getStringEnv('TTS_API_KEY', 'The TTS_API_KEY environment variable is not provided', s => s.optional())!;

export const accessTokenSecret = getStringEnv('ACCESS_TOKEN_SECRET', 'The ACCESS_TOKEN_SECRET environment variable is not provided');
export const refreshTokenSecret = getStringEnv('REFRESH_TOKEN_SECRET', 'The REFRESH_TOKEN_SECRET environment variable is not provided');

export const streamSigningSecret = getStringEnv('STREAM_SIGNING_SECRET', 'The STREAM_SIGNING_SECRET environment variable is not provided');

export const meilisearchKey = getStringEnv('MEILISEARCH_KEY', 'The MEILISEARCH_KEY environment variable is not provided')!;
export const meilisearchHost = getStringEnv('MEILISEARCH_HOST', 'The MEILISEARCH_HOST environment variable is not provided')!;
export const meilisearchPort = getIntegerEnv('MEILISEARCH_PORT', 'The MEILISEARCH_PORT environment variable is not provided')!;

export const BUCKET_NAME = getStringEnv('BUCKET_NAME', 'The BUCKET_NAME environment variable is not provided')!;
export const s3Endpoint = getStringEnv('S3_STORAGE_ENDPOINT', 'The S3_STORAGE_ENDPOINT environment variable is not provided')!;
export const s3AccessKey = getStringEnv('S3_STORAGE_ACCESS_KEY', 'The S3_STORAGE_ACCESS_KEY key environment variable is not provided')!;
export const s3SecretKey = getStringEnv('S3_STORAGE_SECRET_KEY', 'The S3_STORAGE_SECRET_KEY key environment variable is not provided')!;

export const redisConfig = {
    host: getStringEnv('REDIS_HOST', 'The REDIS_HOST environment variable is not provided'),
    port: getIntegerEnv('REDIS_PORT', 'The REDIS_PORT environment variable is not provided'),
    databaseIndex: getIntegerEnv('REDIS_DATABASE_INDEX', 'The REDIS_DATABASE_INDEX environment variable is not provided'),
    supportsTransaction: getBooleanEnv('REDIS_SUPPORTS_TRANSACTION', 'The REDIS_SUPPORTS_TRANSACTION environment variable is not provided'),
    // url: getStringEnv('REDIS_URL', 'The Db url environment variable is not provided'),
    auth: {
        // username: getStringEnv('REDIS_USERNAME', 'The REDIS_USERNAME environment variable is not provided'),
        password: getStringEnv('REDIS_PASSWORD', 'The REDIS_PASSWORD environment variable is not provided'),
    }
};

export const dbConfig = {
    databaseName: getStringEnv('DB_DATABASE_NAME', 'The DB_DATABASE_NAME environment variable is not provided'),
    supportsTransaction: getBooleanEnv('DB_SUPPORTS_TRANSACTION', 'The DB_SUPPORTS_TRANSACTION environment variable is not provided'),
    url: getStringEnv('DB_URL', 'The DB_URL environment variable is not provided'),
    auth: {
        username: getStringEnv('MONGODB_USERNAME', 'The MONGODB_USERNAME environment variable is not provided'),
        password: getStringEnv('MONGODB_PASSWORD', 'The MONGODB_PASSWORD environment variable is not provided'),
    }
};
