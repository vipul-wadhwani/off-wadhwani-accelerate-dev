import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || 'https://dcc007455b48230eccfbc42371397f2c@o4508539300020224.ingest.us.sentry.io/4511052614991872';

const isEnabled = import.meta.env.PROD;

if (isEnabled) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE || 'production',
        integrations: [
            Sentry.browserTracingIntegration(),
        ],
        tracesSampleRate: 0.2,
    });
}

export { Sentry };
