// frontend/resources/js/errorHandling.js

import { logMessage } from './log.js';

/**
 * Error severity levels for categorization and display
 * @readonly
 * @enum {string}
 */
export const ErrorLevel = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
});

/**
 * Comprehensive error handling system with history, callbacks, and retry logic
 * Follows principles: DRY, KISS, defensive programming
 */
export class ErrorHandler {
  constructor() {
    this.errorHistory = [];
    this.maxHistorySize = 100;
    this.errorCallbacks = new Map();
  }

  /**
   * Handle any error with context and severity level
   * @param {Error|string} error - The error to handle
   * @param {Object} context - Additional context (e.g., {function: 'submitJob', jobId: '123'})
   * @param {ErrorLevel} level - Severity level
   * @returns {Object} Error entry that was created
   */
  handleError(error, context = {}, level = ErrorLevel.ERROR) {
    const errorEntry = {
      message: error?.message || String(error),
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      level,
      context,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // Store in history (circular buffer)
    this.errorHistory.push(errorEntry);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Console logging with appropriate level
    const consoleMethod =
      level === ErrorLevel.CRITICAL ? 'error' : level === ErrorLevel.WARNING ? 'warn' : 'log';
    console[consoleMethod]('[ErrorHandler]', errorEntry);

    // Log to user-visible log panel with context
    const logLevel = level === ErrorLevel.CRITICAL ? 'error' : level;
    const contextStr =
      Object.keys(context).length > 0
        ? ` [${Object.entries(context)
            .map(([k, v]) => `${k}:${v}`)
            .join(', ')}]`
        : '';
    logMessage(`${errorEntry.message}${contextStr}`, logLevel);

    // Display to user (safely, with null checks)
    this.displayError(errorEntry.message, level);

    // Trigger registered callbacks
    this.triggerCallbacks(errorEntry);

    return errorEntry;
  }

  /**
   * Safely display error message to user
   * Uses defensive null checking to prevent crashes
   * @param {string} message - Error message to display
   * @param {ErrorLevel} level - Severity level for styling
   */
  displayError(message, level = ErrorLevel.ERROR) {
    const errorDiv = document.getElementById('error');

    if (!errorDiv) {
      console.warn('[ErrorHandler] Error display element #error not found. Message:', message);
      return;
    }

    errorDiv.textContent = message;
    errorDiv.className = `error error-${level}`;
    errorDiv.classList.remove('hidden');
  }

  /**
   * Clear error display
   * Safe even if error element doesn't exist
   */
  clearError() {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
      errorDiv.textContent = '';
      errorDiv.className = 'error hidden'; // Reset to base class with hidden
    }
  }

  /**
   * Register global error handlers for uncaught errors and promise rejections
   * Should be called once during app initialization
   */
  registerGlobalHandlers() {
    // Handle uncaught synchronous errors
    window.addEventListener('error', event => {
      this.handleError(
        event.error || event.message,
        {
          type: 'uncaught',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
        ErrorLevel.CRITICAL
      );
      event.preventDefault(); // Prevent default browser error display
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', event => {
      this.handleError(
        event.reason,
        {
          type: 'unhandled_promise',
          promise: event.promise,
        },
        ErrorLevel.CRITICAL
      );
      event.preventDefault(); // Prevent default browser warning
    });

    logMessage('Global error handlers registered', 'info');
  }

  /**
   * Wrap async function with automatic error handling
   * Useful for event handlers and callbacks
   * @param {Function} fn - Async function to wrap
   * @param {Object} context - Context information for error reporting
   * @returns {Function} Wrapped function that handles errors
   */
  wrapAsync(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error, { ...context, args }, ErrorLevel.ERROR);
        throw error; // Re-throw to allow caller to handle if needed
      }
    };
  }

  /**
   * Retry a function with exponential backoff
   * Based on Cockatiel best practices for fault tolerance
   * @param {Function} fn - Function to retry (sync or async)
   * @param {Object} options - Retry configuration
   * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
   * @param {number} options.baseDelay - Base delay in ms (default: 1000)
   * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
   * @param {Function} options.onRetry - Callback on each retry (attempt, delay, error)
   * @returns {Promise} Result of function
   * @throws {Error} Last error if all retries exhausted
   */
  async retryWithBackoff(fn, options = {}) {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000, onRetry = null } = options;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          // Exponential backoff: delay = baseDelay * 2^attempt, capped at maxDelay
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

          if (onRetry) {
            onRetry(attempt + 1, delay, error);
          }

          // Log retry attempt to user-visible log
          logMessage(
            `Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${error.message}`,
            'warning'
          );

          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Final attempt failed
          this.handleError(
            error,
            {
              retries: attempt,
              function: fn.name,
            },
            ErrorLevel.ERROR
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Get error history with optional filtering
   * @param {ErrorLevel} level - Filter by severity level (optional)
   * @returns {Array} Array of error entries
   */
  getHistory(level = null) {
    if (level) {
      return this.errorHistory.filter(e => e.level === level);
    }
    return [...this.errorHistory]; // Return copy to prevent external mutation
  }

  /**
   * Register callback for error events
   * Useful for telemetry, logging services, etc.
   * @param {string} id - Unique callback identifier
   * @param {Function} callback - Callback function (receives errorEntry)
   */
  onError(id, callback) {
    this.errorCallbacks.set(id, callback);
  }

  /**
   * Unregister callback
   * @param {string} id - Callback identifier to remove
   */
  offError(id) {
    this.errorCallbacks.delete(id);
  }

  /**
   * Trigger all registered error callbacks
   * Wrapped in try-catch to prevent callback errors from breaking the system
   * @param {Object} errorEntry - Error entry to pass to callbacks
   */
  triggerCallbacks(errorEntry) {
    for (const [id, callback] of this.errorCallbacks) {
      try {
        callback(errorEntry);
      } catch (error) {
        console.error(`[ErrorHandler] Error in callback '${id}':`, error);
      }
    }
  }

  /**
   * Clear error history
   * Useful for testing or memory management
   */
  clearHistory() {
    this.errorHistory = [];
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

/**
 * Legacy exports for backwards compatibility
 * Existing code using displayError/clearError will continue to work
 */
export function displayError(message) {
  errorHandler.displayError(message, ErrorLevel.ERROR);
}

export function clearError() {
  errorHandler.clearError();
}
