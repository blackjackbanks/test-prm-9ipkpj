import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorLogger } from '@monitoring/error-logger'; // v1.0.0
import { ApiError } from '../../types/common';

interface ErrorBoundaryProps {
  /** Custom fallback UI component */
  fallback?: ReactNode;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Custom error handler */
  onError?: (error: ApiError) => void;
  /** Child components */
  children: ReactNode;
}

interface ErrorState {
  hasError: boolean;
  error: ApiError | null;
}

/**
 * ErrorBoundary component that provides comprehensive error handling, logging,
 * and recovery mechanisms for React component trees.
 * 
 * @example
 * <ErrorBoundary fallback={<ErrorPage />}>
 *   <App />
 * </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorState> {
  private logger: ErrorLogger;
  private retryCount: number;
  
  static defaultProps = {
    maxRetries: 3,
    fallback: <div role="alert">Something went wrong. Please try again.</div>
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
    this.logger = new ErrorLogger();
    this.retryCount = 0;
    this.resetError = this.resetError.bind(this);
  }

  /**
   * Transforms caught errors into standardized ApiError format
   */
  static getDerivedStateFromError(error: Error): ErrorState {
    // Convert to ApiError format
    const apiError: ApiError = {
      code: error.name || 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: {
        stack: error.stack,
        componentStack: (error as any).componentStack || null
      },
      timestamp: new Date(),
      path: window.location.pathname
    };

    return {
      hasError: true,
      error: apiError
    };
  }

  /**
   * Handles error logging and monitoring
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError } = this.props;
    const errorDetails = {
      error,
      errorInfo,
      location: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    // Log error to monitoring service
    this.logger.logError('ReactError', errorDetails);

    // Track error metrics
    this.logger.incrementMetric('react.errors.count', {
      errorType: error.name,
      componentStack: errorInfo.componentStack
    });

    // Call custom error handler if provided
    if (onError && this.state.error) {
      onError(this.state.error);
    }
  }

  /**
   * Resets error state and implements recovery mechanism
   */
  resetError(): void {
    const { maxRetries } = this.props;
    
    this.retryCount++;
    
    if (this.retryCount <= maxRetries!) {
      this.logger.logInfo('ErrorBoundary.retry', {
        attempt: this.retryCount,
        maxRetries
      });

      this.setState({
        hasError: false,
        error: null
      });
    } else {
      this.logger.logWarning('ErrorBoundary.maxRetriesExceeded', {
        retryCount: this.retryCount
      });
    }
  }

  /**
   * Renders error UI or children with accessibility support
   */
  render(): ReactNode {
    const { children, fallback } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      return (
        <div role="alert" aria-live="polite">
          {fallback}
          {error && (
            <div aria-hidden="true" className="error-details">
              <p>Error Code: {error.code}</p>
              <p>{error.message}</p>
              {process.env.NODE_ENV === 'development' && (
                <pre>{JSON.stringify(error.details, null, 2)}</pre>
              )}
            </div>
          )}
          <button
            onClick={this.resetError}
            disabled={this.retryCount >= (this.props.maxRetries || 3)}
            aria-label="Try again"
          >
            Try Again
          </button>
        </div>
      );
    }

    return children;
  }
}