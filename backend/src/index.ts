import { Sentry } from './config/sentry';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
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

// Start server
const PORT = config.port;
app.listen(PORT, () => {
    logger(`Server running on port ${PORT}`, 'info');
    logger(`Environment: ${config.nodeEnv}`, 'info');
    logger(`Frontend URL: ${config.frontendUrl}`, 'info');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger('SIGTERM signal received: closing HTTP server', 'info');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger('SIGINT signal received: closing HTTP server', 'info');
    process.exit(0);
});

export default app;
