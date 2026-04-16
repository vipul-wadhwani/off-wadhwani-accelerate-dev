import { Sentry } from './config/sentry';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, initConfig } from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger, logRequest } from './utils/logger';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: [
        config.frontendUrl,
        'http://localhost:5173',
        'http://localhost:5174',
        'https://wadhwani-accelerate-dev01.netlify.app',
        'https://devaccelerate.wadhwaniliftoff.ai',
        'https://accelerate.wadhwaniliftoff.ai',
    ].filter(Boolean),
    credentials: true,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    // Debug log
    logger(`Incoming ${req.method} ${req.url} from ${req.ip}`, 'info');
    // logger(`Body: ${JSON.stringify(req.body)}`, 'debug');

    res.on('finish', () => {
        const duration = Date.now() - start;
        logRequest(req.method, req.originalUrl, res.statusCode, duration);
    });

    next();
});

// API routes
app.use('/api', routes);

// Sentry test endpoint — triggers a test error to verify Sentry is working
app.get('/api/sentry-test', (req: Request, res: Response, next: NextFunction) => {
    try {
        throw new Error('Sentry backend test error — safe to ignore');
    } catch (err) {
        Sentry.captureException(err);
        res.json({ success: true, message: 'Test error sent to Sentry (backend). Check your Sentry dashboard.' });
    }
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
    res.json({
        message: 'Wadhwani Ventures API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            docs: '/api/docs (coming soon)',
        },
    });
});

// 404 handler
app.use(notFoundHandler);

// Sentry error handler (must be before custom error handler)
Sentry.setupExpressErrorHandler(app);

// Error handler (must be last)
app.use(errorHandler);

// Load secrets from Azure Key Vault (if configured), then start server
initConfig().then(() => {
    const PORT = config.port;
    const server = app.listen(PORT, () => {
        logger(`Server running on port ${PORT}`, 'info');
        logger(`Environment: ${config.nodeEnv}`, 'info');
        logger(`Frontend URL: ${config.frontendUrl}`, 'info');

        // Start scheduled tasks
        import('./services/reminderService').then(({ startMeetingReminderScheduler }) => {
            startMeetingReminderScheduler();
        }).catch(err => console.error('[Scheduler] Failed to start reminder scheduler:', err.message));
    });

    // Handle graceful shutdown
    function gracefulShutdown(signal: string) {
        logger(`${signal} signal received: closing HTTP server`, 'info');
        server.close(() => {
            logger('HTTP server closed', 'info');
            process.exit(0);
        });
        setTimeout(() => {
            logger('Forcing shutdown after timeout', 'warn');
            process.exit(1);
        }, 10_000).unref();
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}).catch((err) => {
    logger(`Failed to initialize: ${err.message}`, 'error');
    process.exit(1);
});

export default app;
