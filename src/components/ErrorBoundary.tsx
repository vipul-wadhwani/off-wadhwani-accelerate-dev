import React, { Component } from 'react';
import type { ErrorInfo } from 'react';
import { logger } from '../utils/logger';
import { Sentry } from '../config/sentry';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logger.error('ErrorBoundary', `Uncaught error: ${error.message}`, {
            error,
            componentStack: errorInfo.componentStack,
        });
        Sentry.captureException(error, {
            contexts: { react: { componentStack: errorInfo.componentStack || '' } },
        });
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-orange-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full">
                            <span className="text-red-600 text-xl font-bold">!</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
                        <p className="text-gray-600 text-sm">
                            An unexpected error occurred. Please try refreshing the page.
                        </p>
                        {import.meta.env.DEV && this.state.error && (
                            <pre className="text-left text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-40 text-red-600">
                                {this.state.error.message}
                            </pre>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
