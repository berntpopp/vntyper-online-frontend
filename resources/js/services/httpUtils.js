// frontend/resources/js/services/httpUtils.js

import { logMessage } from '../log.js';

/**
 * Fetch with timeout using AbortController
 *
 * Implements timeout protection for fetch requests to prevent infinite hangs
 * on slow networks. Uses AbortController API for clean cancellation.
 *
 * @param {string} url - The URL to fetch
 * @param {Object} [options={}] - Fetch options (method, headers, body, etc.)
 * @param {number} [timeout=30000] - Timeout in milliseconds (default: 30s)
 * @returns {Promise<Response>} The fetch response
 * @throws {Error} Timeout error if request exceeds timeout duration
 * @throws {Error} Network error or other fetch failures
 *
 * @example
 * // Basic usage with default 30s timeout
 * const response = await fetchWithTimeout('/api/data');
 *
 * @example
 * // Custom timeout
 * const response = await fetchWithTimeout('/api/data', {}, 10000); // 10s
 *
 * @example
 * // With external AbortController (allows external cancellation)
 * const controller = new AbortController();
 * const response = await fetchWithTimeout('/api/data', { signal: controller.signal });
 * // Later: controller.abort();
 */
export async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  // Create AbortController for timeout management
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Fetch with combined signal (allows external + timeout cancellation)
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });

    return response;
  } catch (error) {
    // Distinguish between timeout abort and other errors
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`Request timeout after ${timeout}ms`);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    // Always clear timeout to prevent memory leaks
    clearTimeout(timeoutId);
  }
}

/**
 * Parse error response from backend API
 *
 * Centralized error parsing following DRY principle. Handles FastAPI
 * error response format with detail field (string or array of validation errors).
 * Attaches metadata to Error object for downstream handling.
 *
 * @param {Response} response - The failed fetch response
 * @returns {Promise<Error>} Error with parsed message and metadata
 *
 * @example
 * // FastAPI validation error (array)
 * // { detail: [{ msg: "Field required", type: "value_error" }] }
 * // Result: Error("Field required")
 *
 * @example
 * // Simple error (string)
 * // { detail: "Job not found" }
 * // Result: Error("Job not found")
 *
 * @example
 * // Non-JSON response
 * // Result: Error("Request failed with status 500")
 */
export async function parseErrorResponse(response) {
  let errorMessage = `Request failed with status ${response.status}`;

  try {
    // Attempt to parse JSON error response
    const data = await response.json();

    if (data.detail) {
      if (Array.isArray(data.detail)) {
        // FastAPI validation errors: array of { msg, type, loc }
        const parsedDetail = data.detail.map(err => err.msg || err).join(', ');
        // Only use parsed detail if not empty (edge case: empty array)
        if (parsedDetail) {
          errorMessage = parsedDetail;
        }
      } else if (typeof data.detail === 'string') {
        // Simple error message (only if not empty)
        if (data.detail.trim()) {
          errorMessage = data.detail;
        }
      } else if (typeof data.detail === 'object') {
        // Object detail - stringify
        errorMessage = JSON.stringify(data.detail);
      }
    } else if (data.message) {
      // Alternative error format (only if not empty)
      if (typeof data.message === 'string' && data.message.trim()) {
        errorMessage = data.message;
      }
    }
  } catch (e) {
    // Response not JSON or parsing failed - use status text
    errorMessage = response.statusText || errorMessage;
  }

  // Create error with metadata
  const error = new Error(errorMessage);
  error.status = response.status;
  error.response = response;
  error.statusText = response.statusText;

  return error;
}

/**
 * Retry request with exponential backoff
 *
 * Implements retry logic for ONE-SHOT requests only (submit, create).
 * Polling requests use PollingManager for retry (avoid duplication).
 *
 * Features:
 * - Exponential backoff: baseDelay * 2^(attempt-1)
 * - Smart retry: skip 4xx client errors (won't succeed on retry)
 * - Configurable attempts and delay
 *
 * @param {Function} fn - Async function to retry
 * @param {number} [maxAttempts=3] - Maximum retry attempts (default: 3)
 * @param {number} [baseDelay=1000] - Base delay in ms (default: 1000ms)
 * @returns {Promise<*>} Result of successful attempt
 * @throws {Error} Last error if all attempts fail
 *
 * @example
 * // Retry a function up to 3 times
 * const result = await retryRequest(async () => {
 *   const response = await fetch('/api/submit');
 *   return response.json();
 * });
 *
 * @example
 * // Custom retry configuration
 * const result = await retryRequest(
 *   async () => createResource(),
 *   5,    // 5 attempts
 *   2000  // 2s base delay
 * );
 * // Delays: 2s, 4s, 8s, 16s
 */
export async function retryRequest(fn, maxAttempts = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Execute function
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx) - these won't succeed
      // 400: Bad Request, 401: Unauthorized, 403: Forbidden, 404: Not Found
      if (error.status >= 400 && error.status < 500) {
        logMessage(`Client error (${error.status}): ${error.message} - not retrying`, 'error');
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt >= maxAttempts) {
        logMessage(`Request failed after ${maxAttempts} attempts: ${error.message}`, 'error');
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s...
      const delay = baseDelay * Math.pow(2, attempt - 1);

      logMessage(
        `Retry attempt ${attempt}/${maxAttempts} after ${delay}ms (error: ${error.message})`,
        'warning'
      );

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript/flow analysis requires it
  throw lastError;
}
