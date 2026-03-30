import * as Sentry from '@sentry/node';

const SENTRY_DSN_DEV = 'https://dcc007455b48230eccfbc42371397f2c@o4508539300020224.ingest.us.sentry.io/4511052614991872';
const SENTRY_DSN_PROD = 'https://d833052253e122fd356764e3d4ed575a@o4508539300020224.ingest.us.sentry.io/4511076120985600';

function getEnvironment(): 'production' | 'development' {
    // Detect via Supabase URL — prod project ID is 'jenyuppryecuirvvlvkb'
    const supabaseUrl = process.env.SUPABASE_URL || '';
    if (supabaseUrl.includes('jenyuppryecuirvvlvkb')) return 'production';
    return 'development';
}

const environment = getEnvironment();
const SENTRY_DSN = process.env.SENTRY_DSN || (environment === 'production' ? SENTRY_DSN_PROD : SENTRY_DSN_DEV);

const isEnabled = process.env.NODE_ENV !== 'development';

if (isEnabled) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment,
        sendDefaultPii: true,
    });
}

export { Sentry };
