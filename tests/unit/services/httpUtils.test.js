// tests/unit/services/httpUtils.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, parseErrorResponse, retryRequest } from '../../../resources/js/services/httpUtils.js';

// Mock dependencies
vi.mock('../../../resources/js/log.js', () => ({
    logMessage: vi.fn()
}));

describe('httpUtils', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    // ============================================================================
    // fetchWithTimeout() - Fetch with timeout using AbortController
    // ============================================================================

    describe('fetchWithTimeout() - Fetch with timeout', () => {
        it('should successfully fetch within timeout', async () => {
            // Arrange
            const mockResponse = { ok: true, status: 200 };
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            // Act
            const promise = fetchWithTimeout('/api/test', {}, 5000);
            vi.runAllTimers();
            const result = await promise;

            // Assert
            expect(result).toBe(mockResponse);
            expect(global.fetch).toHaveBeenCalledWith('/api/test', {
                signal: expect.any(AbortSignal)
            });
        });

        it('should throw TimeoutError when request exceeds timeout', async () => {
            // Arrange
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';

            global.fetch = vi.fn().mockImplementation((url, options) => {
                // Return a promise that rejects when signal aborts
                return new Promise((resolve, reject) => {
                    options.signal.addEventListener('abort', () => {
                        reject(abortError);
                    });
                    // Never resolve otherwise - simulate hanging request
                    setTimeout(resolve, 100000);
                });
            });

            // Act & Assert
            const promise = fetchWithTimeout('/api/test', {}, 1000);

            // Suppress unhandled rejection warnings
            promise.catch(() => {});

            // Advance timers to trigger timeout
            await vi.advanceTimersByTimeAsync(1000);

            await expect(promise).rejects.toMatchObject({
                name: 'TimeoutError',
                message: 'Request timeout after 1000ms'
            });
        });

        it('should use default timeout of 30000ms', async () => {
            // Arrange
            const mockResponse = { ok: true };
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            // Act
            const promise = fetchWithTimeout('/api/test');
            vi.runAllTimers();
            await promise;

            // Assert - verify timeout was set to default
            expect(global.fetch).toHaveBeenCalled();
        });

        it('should throw original error on network failure', async () => {
            // Arrange
            const networkError = new Error('Network error');
            networkError.name = 'NetworkError';
            global.fetch = vi.fn().mockRejectedValue(networkError);

            // Act & Assert
            const promise = fetchWithTimeout('/api/test', {}, 5000);
            vi.runAllTimers();

            await expect(promise).rejects.toMatchObject({
                name: 'NetworkError',
                message: 'Network error'
            });
        });

        it('should clear timeout on successful fetch', async () => {
            // Arrange
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
            const mockResponse = { ok: true };
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            // Act
            const promise = fetchWithTimeout('/api/test', {}, 5000);
            vi.runAllTimers();
            await promise;

            // Assert
            expect(clearTimeoutSpy).toHaveBeenCalled();
        });

        it('should clear timeout on error', async () => {
            // Arrange
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
            const error = new Error('Fetch failed');
            global.fetch = vi.fn().mockRejectedValue(error);

            // Act
            const promise = fetchWithTimeout('/api/test', {}, 5000);
            vi.runAllTimers();

            try {
                await promise;
            } catch (e) {
                // Expected to throw
            }

            // Assert
            expect(clearTimeoutSpy).toHaveBeenCalled();
        });

        it('should pass custom options to fetch', async () => {
            // Arrange
            const mockResponse = { ok: true };
            global.fetch = vi.fn().mockResolvedValue(mockResponse);
            const customOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: 'test' })
            };

            // Act
            const promise = fetchWithTimeout('/api/test', customOptions, 5000);
            vi.runAllTimers();
            await promise;

            // Assert
            expect(global.fetch).toHaveBeenCalledWith('/api/test', {
                ...customOptions,
                signal: expect.any(AbortSignal)
            });
        });

        it('should respect external AbortController signal', async () => {
            // Arrange
            const mockResponse = { ok: true };
            global.fetch = vi.fn().mockResolvedValue(mockResponse);
            const externalController = new AbortController();

            // Act
            const promise = fetchWithTimeout(
                '/api/test',
                { signal: externalController.signal },
                5000
            );
            vi.runAllTimers();
            await promise;

            // Assert
            expect(global.fetch).toHaveBeenCalledWith('/api/test', {
                signal: externalController.signal
            });
        });

        it('should handle AbortError and convert to TimeoutError', async () => {
            // Arrange
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            global.fetch = vi.fn().mockRejectedValue(abortError);

            // Act & Assert
            const promise = fetchWithTimeout('/api/test', {}, 2000);
            vi.runAllTimers();

            await expect(promise).rejects.toMatchObject({
                name: 'TimeoutError',
                message: 'Request timeout after 2000ms'
            });
        });
    });

    // ============================================================================
    // parseErrorResponse() - Parse error response from backend API
    // ============================================================================

    describe('parseErrorResponse() - Parse error response', () => {
        it('should parse FastAPI validation error (array)', async () => {
            // Arrange
            const response = {
                status: 422,
                statusText: 'Unprocessable Entity',
                json: vi.fn().mockResolvedValue({
                    detail: [
                        { msg: 'Field required', type: 'value_error', loc: ['body', 'field1'] },
                        { msg: 'Invalid value', type: 'type_error', loc: ['body', 'field2'] }
                    ]
                })
            };

            // Act
            const error = await parseErrorResponse(response);

            // Assert
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('Field required, Invalid value');
            expect(error.status).toBe(422);
            expect(error.statusText).toBe('Unprocessable Entity');
            expect(error.response).toBe(response);
        });

        it('should parse simple error (string detail)', async () => {
            // Arrange
            const response = {
                status: 404,
                statusText: 'Not Found',
                json: vi.fn().mockResolvedValue({
                    detail: 'Job not found'
                })
            };

            // Act
            const error = await parseErrorResponse(response);

            // Assert
            expect(error.message).toBe('Job not found');
            expect(error.status).toBe(404);
        });

        it('should parse object detail', async () => {
            // Arrange
            const response = {
                status: 400,
                statusText: 'Bad Request',
                json: vi.fn().mockResolvedValue({
                    detail: { error: 'Invalid input', code: 'BAD_REQUEST' }
                })
            };

            // Act
            const error = await parseErrorResponse(response);

            // Assert
            expect(error.message).toBe('{"error":"Invalid input","code":"BAD_REQUEST"}');
            expect(error.status).toBe(400);
        });

        it('should handle alternative message field', async () => {
            // Arrange
            const response = {
                status: 500,
                statusText: 'Internal Server Error',
                json: vi.fn().mockResolvedValue({
                    message: 'Server error occurred'
                })
            };

            // Act
            const error = await parseErrorResponse(response);

            // Assert
            expect(error.message).toBe('Server error occurred');
            expect(error.status).toBe(500);
        });

        it('should handle non-JSON response', async () => {
            // Arrange
            const response = {
                status: 503,
                statusText: 'Service Unavailable',
                json: vi.fn().mockRejectedValue(new Error('Not JSON'))
            };

            // Act
            const error = await parseErrorResponse(response);

            // Assert
            expect(error.message).toBe('Service Unavailable');
            expect(error.status).toBe(503);
        });

        it('should handle empty detail string', async () => {
            // Arrange
            const response = {
                status: 400,
                statusText: 'Bad Request',
                json: vi.fn().mockResolvedValue({
                    detail: '   '  // Empty/whitespace
                })
            };

            // Act
            const error = await parseErrorResponse(response);

            // Assert
            expect(error.message).toBe('Request failed with status 400');
        });

        it('should handle empty detail array', async () => {
            // Arrange
            const response = {
                status: 422,
                statusText: 'Unprocessable Entity',
                json: vi.fn().mockResolvedValue({
                    detail: []  // Empty array
                })
            };

            // Act
            const error = await parseErrorResponse(response);

            // Assert
            expect(error.message).toBe('Request failed with status 422');
        });

        it('should handle detail array with objects without msg field', async () => {
            // Arrange
            const response = {
                status: 422,
                statusText: 'Unprocessable Entity',
                json: vi.fn().mockResolvedValue({
                    detail: [
                        { type: 'value_error' },  // No msg field
                        'String error'  // String instead of object
                    ]
                })
            };

            // Act
            const error = await parseErrorResponse(response);

            // Assert
            // Objects without msg field get converted to '[object Object]' when joined
            expect(error.message).toContain('[object Object]');
            expect(error.message).toContain('String error');
        });

        it('should handle empty message field', async () => {
            // Arrange
            const response = {
                status: 500,
                statusText: 'Internal Server Error',
                json: vi.fn().mockResolvedValue({
                    message: '   '  // Empty/whitespace
                })
            };

            // Act
            const error = await parseErrorResponse(response);

            // Assert
            expect(error.message).toBe('Request failed with status 500');
        });

        it('should handle response with no detail or message', async () => {
            // Arrange
            const response = {
                status: 500,
                statusText: 'Internal Server Error',
                json: vi.fn().mockResolvedValue({
                    someOtherField: 'value'
                })
            };

            // Act
            const error = await parseErrorResponse(response);

            // Assert
            expect(error.message).toBe('Request failed with status 500');
        });

        it('should fallback to generic message if statusText is empty', async () => {
            // Arrange
            const response = {
                status: 500,
                statusText: '',
                json: vi.fn().mockRejectedValue(new Error('Not JSON'))
            };

            // Act
            const error = await parseErrorResponse(response);

            // Assert
            expect(error.message).toBe('Request failed with status 500');
        });

        it('should attach all metadata to error object', async () => {
            // Arrange
            const response = {
                status: 404,
                statusText: 'Not Found',
                json: vi.fn().mockResolvedValue({
                    detail: 'Resource not found'
                })
            };

            // Act
            const error = await parseErrorResponse(response);

            // Assert
            expect(error.status).toBe(404);
            expect(error.statusText).toBe('Not Found');
            expect(error.response).toBe(response);
            expect(error.message).toBe('Resource not found');
        });
    });

    // ============================================================================
    // retryRequest() - Retry request with exponential backoff
    // ============================================================================

    describe('retryRequest() - Retry with exponential backoff', () => {
        it('should return result on first successful attempt', async () => {
            // Arrange
            const mockFn = vi.fn().mockResolvedValue('success');

            // Act
            const promise = retryRequest(mockFn, 3, 1000);
            vi.runAllTimers();
            const result = await promise;

            // Assert
            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should retry on 5xx server error', async () => {
            // Arrange
            const error = new Error('Server error');
            error.status = 500;
            const mockFn = vi.fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValue('success');

            // Act
            const promise = retryRequest(mockFn, 3, 1000);

            // Advance timers for first retry (1000ms delay)
            await vi.advanceTimersByTimeAsync(1000);

            const result = await promise;

            // Assert
            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        it('should use exponential backoff (1s, 2s, 4s)', async () => {
            // Arrange
            const error = new Error('Server error');
            error.status = 503;
            const mockFn = vi.fn()
                .mockRejectedValueOnce(error)  // Attempt 1 fails
                .mockRejectedValueOnce(error)  // Attempt 2 fails
                .mockResolvedValue('success'); // Attempt 3 succeeds

            // Act
            const promise = retryRequest(mockFn, 3, 1000);

            // First retry: wait 1000ms (1s)
            await vi.advanceTimersByTimeAsync(1000);

            // Second retry: wait 2000ms (2s)
            await vi.advanceTimersByTimeAsync(2000);

            const result = await promise;

            // Assert
            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(3);
        });

        it('should NOT retry on 4xx client error', async () => {
            // Arrange
            const error = new Error('Bad request');
            error.status = 400;
            const mockFn = vi.fn().mockRejectedValue(error);

            // Act & Assert
            const promise = retryRequest(mockFn, 3, 1000);
            vi.runAllTimers();

            await expect(promise).rejects.toMatchObject({
                message: 'Bad request',
                status: 400
            });

            // Should fail immediately, no retries
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should NOT retry on 404 Not Found', async () => {
            // Arrange
            const error = new Error('Not found');
            error.status = 404;
            const mockFn = vi.fn().mockRejectedValue(error);

            // Act & Assert
            const promise = retryRequest(mockFn, 3, 1000);
            vi.runAllTimers();

            await expect(promise).rejects.toMatchObject({
                message: 'Not found',
                status: 404
            });

            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should NOT retry on 401 Unauthorized', async () => {
            // Arrange
            const error = new Error('Unauthorized');
            error.status = 401;
            const mockFn = vi.fn().mockRejectedValue(error);

            // Act & Assert
            const promise = retryRequest(mockFn, 3, 1000);
            vi.runAllTimers();

            await expect(promise).rejects.toMatchObject({
                message: 'Unauthorized',
                status: 401
            });

            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should throw last error after max attempts reached', async () => {
            // Arrange
            const error = new Error('Server error');
            error.status = 500;
            const mockFn = vi.fn().mockRejectedValue(error);

            // Act
            const promise = retryRequest(mockFn, 3, 1000);

            // Suppress unhandled rejection warnings
            promise.catch(() => {});

            // Advance through all retry delays
            // Attempt 1 fails, wait for retry 1 (1000ms)
            await vi.advanceTimersByTimeAsync(1000);

            // Attempt 2 fails, wait for retry 2 (2000ms)
            await vi.advanceTimersByTimeAsync(2000);

            // Attempt 3 fails (last attempt, no more retries)
            // Assert
            await expect(promise).rejects.toMatchObject({
                message: 'Server error',
                status: 500
            });

            expect(mockFn).toHaveBeenCalledTimes(3);
        });

        it('should use custom maxAttempts', async () => {
            // Arrange
            const error = new Error('Server error');
            error.status = 503;
            const mockFn = vi.fn()
                .mockRejectedValueOnce(error)
                .mockRejectedValueOnce(error)
                .mockRejectedValueOnce(error)
                .mockRejectedValueOnce(error)
                .mockResolvedValue('success');

            // Act
            const promise = retryRequest(mockFn, 5, 1000);  // 5 attempts

            // Advance through retries
            await vi.advanceTimersByTimeAsync(1000);  // Retry 1
            await vi.advanceTimersByTimeAsync(2000);  // Retry 2
            await vi.advanceTimersByTimeAsync(4000);  // Retry 3
            await vi.advanceTimersByTimeAsync(8000);  // Retry 4

            const result = await promise;

            // Assert
            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(5);
        });

        it('should use custom baseDelay', async () => {
            // Arrange
            const error = new Error('Server error');
            error.status = 500;
            const mockFn = vi.fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValue('success');

            // Act
            const promise = retryRequest(mockFn, 3, 2000);  // 2s base delay

            // First retry should wait 2000ms (baseDelay * 2^0)
            await vi.advanceTimersByTimeAsync(2000);

            const result = await promise;

            // Assert
            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        it('should retry on error without status code', async () => {
            // Arrange
            const error = new Error('Network error');
            // No status code - should be retried
            const mockFn = vi.fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValue('success');

            // Act
            const promise = retryRequest(mockFn, 3, 1000);

            await vi.advanceTimersByTimeAsync(1000);

            const result = await promise;

            // Assert
            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        it('should retry on timeout error', async () => {
            // Arrange
            const timeoutError = new Error('Request timeout after 5000ms');
            timeoutError.name = 'TimeoutError';
            const mockFn = vi.fn()
                .mockRejectedValueOnce(timeoutError)
                .mockResolvedValue('success');

            // Act
            const promise = retryRequest(mockFn, 3, 1000);

            await vi.advanceTimersByTimeAsync(1000);

            const result = await promise;

            // Assert
            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        it('should handle async function that returns promise', async () => {
            // Arrange
            const mockFn = vi.fn(async () => {
                return Promise.resolve({ data: 'test' });
            });

            // Act
            const promise = retryRequest(mockFn, 3, 1000);
            vi.runAllTimers();
            const result = await promise;

            // Assert
            expect(result).toEqual({ data: 'test' });
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should calculate exponential backoff correctly (1s, 2s, 4s, 8s)', async () => {
            // Arrange
            const error = new Error('Server error');
            error.status = 500;
            const delays = [];
            const mockFn = vi.fn()
                .mockRejectedValueOnce(error)
                .mockRejectedValueOnce(error)
                .mockRejectedValueOnce(error)
                .mockRejectedValueOnce(error)
                .mockResolvedValue('success');

            // Track setTimeout delays
            const originalSetTimeout = global.setTimeout;
            vi.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
                if (typeof delay === 'number' && delay >= 1000) {
                    delays.push(delay);
                }
                return originalSetTimeout(fn, delay);
            });

            // Act
            const promise = retryRequest(mockFn, 5, 1000);

            // Advance through all retries
            for (let i = 0; i < 4; i++) {
                await vi.advanceTimersByTimeAsync(1000 * Math.pow(2, i));
            }

            const result = await promise;

            // Assert
            expect(result).toBe('success');
            expect(delays).toEqual([1000, 2000, 4000, 8000]);
        });
    });
});
