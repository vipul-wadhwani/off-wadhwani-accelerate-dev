import * as Sentry from '@sentry/react';

const SENTRY_DSN_DEV = 'https://d5f9fadef0dd689ed4d45bf4f58ce702@o4508539300020224.ingest.us.sentry.io/4511099338883072';
const SENTRY_DSN_PROD = 'https://d4a340a8e655ebaff1ac6e6f5657de31@o4508539300020224.ingest.us.sentry.io/4511076127342592';

function getEnvironment(): 'production' | 'development' {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (hostname.includes('devaccelerate')) return 'development';
    if (hostname.includes('wadhwani') || hostname.includes('netlify')) return 'production';
    return 'development';
}

const environment = getEnvironment();
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || (environment === 'production' ? SENTRY_DSN_PROD : SENTRY_DSN_DEV);

const isEnabled = import.meta.env.PROD;

if (isEnabled) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment,
        integrations: [
            Sentry.browserTracingIntegration(),
        ],
        tracesSampleRate: 0.2,
    });
}

// Expose test function on window for verifying Sentry in deployed environments
// Usage: open browser console and run window.__testSentry()
if (typeof window !== 'undefined') {
    (window as any).__testSentry = () => {
        Sentry.captureException(new Error('Sentry frontend test error — safe to ignore'));
        console.log(`Sentry test error sent (environment: ${environment}, enabled: ${isEnabled})`);
    };
}

export { Sentry };
