// -----------------------------------------------------------------------------
// This file MUST be loaded before anything else in the process — before
// express, mongodb, http, or any instrumented module is imported. OTel's
// auto-instrumentation works by monkey-patching modules the moment they're
// require()'d; if express loads first, its patches never apply.
//
// Wire it in via NODE_OPTIONS or a --require flag, NOT via a normal import
// at the top of app.ts:
//
//   node --require ./dist/observability/tracing.js dist/index.js
//
// or in package.json:
//   "start": "node --require ./dist/observability/tracing.js dist/index.js"
//
// If your build targets ESM (tsconfig "module": "nodenext"/"esnext"), swap
// --require for --import, and see the ESM note in the README this ships
// with — the require-hook approach above only works for CommonJS output.
// -----------------------------------------------------------------------------

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION,
    ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions';

// Alloy's OTLP HTTP receiver — see config.alloy's otelcol.receiver.otlp
// block. Backend and alloy must share a Docker network (backend_net).
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://alloy:4318';

const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'memoize-backend',
        [ATTR_SERVICE_VERSION]: process.env.MEMOIZE_BACKEND_VERSION ?? 'unknown',
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV ?? 'development',
    }),

    traceExporter: new OTLPTraceExporter({
        url: `${otlpEndpoint}/v1/traces`,
    }),

    instrumentations: [
        getNodeAutoInstrumentations({
            // Instruments express, http, mongodb, aws-sdk (S3), dns, etc. out of
            // the box. Disable the noisy/low-value ones explicitly rather than
            // letting them flood every trace:
            '@opentelemetry/instrumentation-fs': { enabled: false },
            '@opentelemetry/instrumentation-http': {
                // Don't create spans for Prometheus scraping your own /metrics,
                // or for Docker/nginx health checks against /healthz.
                ignoreIncomingRequestHook: (req) =>
                    req.url === '/metrics' || req.url === '/healthz' || req.url === '/readyz',
            },
        }),
    ],
});

sdk.start();

// Flush any pending spans before the process actually exits, instead of
// silently dropping the last batch on a container restart/redeploy.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
        sdk
            .shutdown()
            .catch((err) => console.error('otel shutdown error', err))
            .finally(() => process.exit(0));
    });
}