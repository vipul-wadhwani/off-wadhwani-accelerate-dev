import { Request, Response, NextFunction } from 'express';
import { Sentry } from '../config/sentry';

/**
 * Global error handler middleware
 */
export function errorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) {
    console.error('Error:', err);
    Sentry.captureException(err);

    // Default error
    let statusCode = 500;
    let message = 'Internal server error';

    // Handle specific error types
    if (err.statusCode) {
        statusCode = err.statusCode;
    }

    if (err.message) {
        message = err.message;
    }

    // Supabase errors
    if (err.code) {
        switch (err.code) {
            case 'PGRST116':
                statusCode = 404;
                message = 'Resource not found';
                break;
            case '23505':
                statusCode = 409;
                message = 'Resource already exists';
                break;
            case '23503':
                statusCode = 400;
                message = 'Invalid reference';
                break;
            case '42501':
                statusCode = 403;
                message = 'Insufficient permissions';
                break;
        }
    }

    // Send error response
    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response) {
    res.status(404).json({
        error: 'Route not found',
        path: req.path,
        method: req.method,
    });
}
