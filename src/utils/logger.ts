type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const isDev = import.meta.env.DEV;

function formatMessage(level: LogLevel, module: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}`;
}

export const logger = {
    info(module: string, message: string, data?: any) {
        const msg = formatMessage('info', module, message);
        if (data) {
            console.info(msg, data);
        } else {
            console.info(msg);
        }
    },

    warn(module: string, message: string, data?: any) {
        const msg = formatMessage('warn', module, message);
        if (data) {
            console.warn(msg, data);
        } else {
            console.warn(msg);
        }
    },

    error(module: string, message: string, error?: any) {
        const msg = formatMessage('error', module, message);
        if (error) {
            console.error(msg, error);
        } else {
            console.error(msg);
        }
    },

    debug(module: string, message: string, data?: any) {
        if (!isDev) return;
        const msg = formatMessage('debug', module, message);
        if (data) {
            console.debug(msg, data);
        } else {
            console.debug(msg);
        }
    },
};
