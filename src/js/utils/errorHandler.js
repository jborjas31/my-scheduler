// Comprehensive error handling strategy
import { showError } from './domUtils.js';

/**
 * @typedef {Object} ErrorDetails
 * @property {string} message - User-friendly error message
 * @property {string} code - Error code for logging
 * @property {string} [context] - Additional context information
 * @property {Error} [originalError] - Original error object
 */

/**
 * Centralized error handler for the application
 */
class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.setupGlobalErrorHandlers();
    }

    /**
     * Setup global error handlers for uncaught errors
     */
    setupGlobalErrorHandlers() {
        // Handle uncaught JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleError({
                message: 'An unexpected error occurred',
                code: 'UNCAUGHT_ERROR',
                context: `${event.filename}:${event.lineno}:${event.colno}`,
                originalError: event.error
            });
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                message: 'A background operation failed',
                code: 'UNHANDLED_REJECTION',
                context: 'Promise rejection',
                originalError: event.reason
            });
            event.preventDefault(); // Prevent console error
        });
    }

    /**
     * Handle and log errors with appropriate user feedback
     * @param {ErrorDetails} errorDetails
     */
    handleError(errorDetails) {
        // Log error for debugging
        this.logError(errorDetails);

        // Show user-friendly message
        showError(errorDetails.message);

        // In development, also log to console
        if (this.isDevelopment()) {
            console.error('Application Error:', errorDetails);
        }
    }

    /**
     * Log error to internal log (could be extended to send to external service)
     * @param {ErrorDetails} errorDetails
     */
    logError(errorDetails) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            ...errorDetails
        };

        this.errorLog.push(logEntry);

        // Keep only last 50 errors to prevent memory issues
        if (this.errorLog.length > 50) {
            this.errorLog.shift();
        }
    }

    /**
     * Check if running in development mode
     * @returns {boolean}
     */
    isDevelopment() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.hostname.includes('dev');
    }

    /**
     * Get recent error logs (for debugging)
     * @returns {Array} Recent error log entries
     */
    getErrorLog() {
        return [...this.errorLog];
    }

    /**
     * Clear error log
     */
    clearErrorLog() {
        this.errorLog = [];
    }
}

// Error type constants for consistent error handling
export const ERROR_TYPES = {
    VALIDATION: 'VALIDATION_ERROR',
    NETWORK: 'NETWORK_ERROR',
    FIREBASE: 'FIREBASE_ERROR',
    DATA: 'DATA_ERROR',
    UI: 'UI_ERROR',
    PERMISSION: 'PERMISSION_ERROR'
};

// User-friendly error messages
export const ERROR_MESSAGES = {
    [ERROR_TYPES.VALIDATION]: 'Please check your input and try again',
    [ERROR_TYPES.NETWORK]: 'Please check your internet connection and try again',
    [ERROR_TYPES.FIREBASE]: 'Database operation failed. Please try again',
    [ERROR_TYPES.DATA]: 'Invalid data encountered. Please refresh and try again',
    [ERROR_TYPES.UI]: 'Interface error occurred. Please refresh the page',
    [ERROR_TYPES.PERMISSION]: 'Access denied. Please check your permissions'
};

// Create global error handler instance
export const errorHandler = new ErrorHandler();

/**
 * Utility function to wrap async operations with error handling
 * @param {Function} operation - Async operation to wrap
 * @param {string} context - Context description for errors
 * @returns {Function} Wrapped operation
 */
export function withErrorHandling(operation, context) {
    return async function(...args) {
        try {
            return await operation.apply(this, args);
        } catch (error) {
            const errorCode = mapErrorToType(error);
            errorHandler.handleError({
                message: ERROR_MESSAGES[errorCode] || 'An unexpected error occurred',
                code: errorCode,
                context,
                originalError: error
            });
            throw error; // Re-throw for caller to handle if needed
        }
    };
}

/**
 * Map specific errors to error types
 * @param {Error} error
 * @returns {string} Error type
 */
function mapErrorToType(error) {
    if (!error) return ERROR_TYPES.DATA;

    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';

    // Firebase-specific errors
    if (code.includes('permission-denied') || code.includes('unauthenticated')) {
        return ERROR_TYPES.PERMISSION;
    }
    if (code.includes('unavailable') || code.includes('network')) {
        return ERROR_TYPES.NETWORK;
    }
    if (code.includes('firebase') || error.name === 'FirebaseError') {
        return ERROR_TYPES.FIREBASE;
    }

    // Network errors
    if (message.includes('network') || message.includes('fetch') || 
        message.includes('connection') || error.name === 'NetworkError') {
        return ERROR_TYPES.NETWORK;
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') ||
        message.includes('required') || message.includes('format')) {
        return ERROR_TYPES.VALIDATION;
    }

    // Default to data error
    return ERROR_TYPES.DATA;
}

/**
 * Create a user-friendly error from a technical error
 * @param {Error} error - Technical error
 * @param {string} [userMessage] - Custom user message
 * @returns {ErrorDetails}
 */
export function createUserFriendlyError(error, userMessage) {
    const errorType = mapErrorToType(error);
    return {
        message: userMessage || ERROR_MESSAGES[errorType] || 'An unexpected error occurred',
        code: errorType,
        context: error.message,
        originalError: error
    };
}

/**
 * Retry mechanism for failed operations
 * @param {Function} operation - Operation to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise} Result of operation
 */
export async function retryOperation(operation, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Don't retry certain error types
            const errorType = mapErrorToType(error);
            if (errorType === ERROR_TYPES.VALIDATION || errorType === ERROR_TYPES.PERMISSION) {
                throw error;
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
    }
    
    throw lastError;
}