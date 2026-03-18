import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN || 'https://dcc007455b48230eccfbc42371397f2c@o4508539300020224.ingest.us.sentry.io/4511052614991872';

const isEnabled = process.env.NODE_ENV !== 'development';

if (isEnabled) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        sendDefaultPii: true,
    });
}

export { Sentry };
