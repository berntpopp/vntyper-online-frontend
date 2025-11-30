// tests/unit/utils/errorHandling.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ErrorHandler,
  ErrorLevel,
  errorHandler,
  displayError,
  clearError,
} from '../../../resources/js/errorHandling.js';

// Mock log.js module
vi.mock('../../../resources/js/log.js', () => ({
  logMessage: vi.fn(),
}));

// Import mocked function
import { logMessage } from '../../../resources/js/log.js';

describe('ErrorHandler', () => {
  let handler;
  let mockErrorElement;

  beforeEach(() => {
    // Create fresh ErrorHandler instance for each test
    handler = new ErrorHandler();

    // Mock DOM error element
    mockErrorElement = {
      textContent: '',
      className: '',
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };
    vi.spyOn(document, 'getElementById').mockReturnValue(mockErrorElement);

    // Mock window.location and navigator for error context
    vi.stubGlobal('window', {
      location: { href: 'http://localhost:3000/test' },
      addEventListener: vi.fn(),
    });
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Test)',
    });

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Constructor
  // ============================================================================

  describe('constructor()', () => {
    it('should initialize with empty error history', () => {
      expect(handler.errorHistory).toEqual([]);
    });

    it('should set maxHistorySize to 100', () => {
      expect(handler.maxHistorySize).toBe(100);
    });

    it('should initialize errorCallbacks Map', () => {
      expect(handler.errorCallbacks).toBeInstanceOf(Map);
      expect(handler.errorCallbacks.size).toBe(0);
    });
  });

  // ============================================================================
  // handleError() - Basic functionality
  // ============================================================================

  describe('handleError() - Basic functionality', () => {
    it('should handle Error object', () => {
      // Arrange
      const error = new Error('Test error');

      // Act
      const result = handler.handleError(error);

      // Assert
      expect(result.message).toBe('Test error');
      expect(result.stack).toBeDefined();
      expect(result.level).toBe(ErrorLevel.ERROR);
    });

    it('should handle string error', () => {
      // Arrange
      const error = 'String error message';

      // Act
      const result = handler.handleError(error);

      // Assert
      expect(result.message).toBe('String error message');
      expect(result.level).toBe(ErrorLevel.ERROR);
    });

    it('should include timestamp in ISO format', () => {
      // Act
      const result = handler.handleError(new Error('Test'));

      // Assert
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should include current URL', () => {
      // Act
      const result = handler.handleError(new Error('Test'));

      // Assert
      expect(result.url).toBeDefined();
      expect(typeof result.url).toBe('string');
    });

    it('should include user agent', () => {
      // Act
      const result = handler.handleError(new Error('Test'));

      // Assert
      expect(result.userAgent).toBeDefined();
      expect(typeof result.userAgent).toBe('string');
    });

    it('should add error to history', () => {
      // Act
      handler.handleError(new Error('Error 1'));
      handler.handleError(new Error('Error 2'));

      // Assert
      expect(handler.errorHistory.length).toBe(2);
      expect(handler.errorHistory[0].message).toBe('Error 1');
      expect(handler.errorHistory[1].message).toBe('Error 2');
    });

    it('should limit history to maxHistorySize', () => {
      // Arrange
      handler.maxHistorySize = 3;

      // Act
      handler.handleError(new Error('Error 1'));
      handler.handleError(new Error('Error 2'));
      handler.handleError(new Error('Error 3'));
      handler.handleError(new Error('Error 4'));

      // Assert
      expect(handler.errorHistory.length).toBe(3);
      expect(handler.errorHistory[0].message).toBe('Error 2');
      expect(handler.errorHistory[2].message).toBe('Error 4');
    });
  });

  // ============================================================================
  // handleError() - Context and severity
  // ============================================================================

  describe('handleError() - Context and severity', () => {
    it('should include context in error entry', () => {
      // Arrange
      const context = {
        function: 'submitJob',
        jobId: '123',
        userId: 'user-456',
      };

      // Act
      const result = handler.handleError(new Error('Test'), context);

      // Assert
      expect(result.context).toEqual(context);
    });

    it('should use ERROR level by default', () => {
      // Act
      const result = handler.handleError(new Error('Test'));

      // Assert
      expect(result.level).toBe(ErrorLevel.ERROR);
    });

    it('should respect custom error level', () => {
      // Act
      const result = handler.handleError(new Error('Test'), {}, ErrorLevel.WARNING);

      // Assert
      expect(result.level).toBe(ErrorLevel.WARNING);
    });

    it('should handle INFO level', () => {
      // Act
      const result = handler.handleError('Info message', {}, ErrorLevel.INFO);

      // Assert
      expect(result.level).toBe(ErrorLevel.INFO);
    });

    it('should handle CRITICAL level', () => {
      // Act
      const result = handler.handleError(new Error('Critical'), {}, ErrorLevel.CRITICAL);

      // Assert
      expect(result.level).toBe(ErrorLevel.CRITICAL);
    });
  });

  // ============================================================================
  // handleError() - Logging
  // ============================================================================

  describe('handleError() - Logging', () => {
    it('should log error to console with ERROR level', () => {
      // Act
      handler.handleError(new Error('Test error'));

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        '[ErrorHandler]',
        expect.objectContaining({ message: 'Test error' })
      );
    });

    it('should use console.warn for WARNING level', () => {
      // Act
      handler.handleError('Warning', {}, ErrorLevel.WARNING);

      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        '[ErrorHandler]',
        expect.objectContaining({ level: ErrorLevel.WARNING })
      );
    });

    it('should use console.error for CRITICAL level', () => {
      // Act
      handler.handleError(new Error('Critical'), {}, ErrorLevel.CRITICAL);

      // Assert
      expect(console.error).toHaveBeenCalledWith(
        '[ErrorHandler]',
        expect.objectContaining({ level: ErrorLevel.CRITICAL })
      );
    });

    it('should log to logMessage with context', () => {
      // Arrange
      const context = { function: 'test', id: '123' };

      // Act
      handler.handleError(new Error('Test'), context, ErrorLevel.ERROR);

      // Assert
      expect(logMessage).toHaveBeenCalledWith('Test [function:test, id:123]', 'error');
    });

    it('should log without context string when empty', () => {
      // Act
      handler.handleError('Simple error');

      // Assert
      expect(logMessage).toHaveBeenCalledWith('Simple error', 'error');
    });
  });

  // ============================================================================
  // handleError() - Callbacks
  // ============================================================================

  describe('handleError() - Callbacks', () => {
    it('should trigger registered callbacks', () => {
      // Arrange
      const callback = vi.fn();
      handler.onError('test-callback', callback);

      // Act
      const errorEntry = handler.handleError(new Error('Test'));

      // Assert
      expect(callback).toHaveBeenCalledWith(errorEntry);
    });

    it('should trigger multiple callbacks', () => {
      // Arrange
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      handler.onError('callback1', callback1);
      handler.onError('callback2', callback2);

      // Act
      handler.handleError(new Error('Test'));

      // Assert
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // displayError()
  // ============================================================================

  describe('displayError()', () => {
    it('should set error message in DOM element', () => {
      // Act
      handler.displayError('Error message');

      // Assert
      expect(mockErrorElement.textContent).toBe('Error message');
    });

    it('should set error class with level', () => {
      // Act
      handler.displayError('Error', ErrorLevel.WARNING);

      // Assert
      expect(mockErrorElement.className).toBe('error error-warning');
    });

    it('should remove hidden class', () => {
      // Act
      handler.displayError('Error');

      // Assert
      expect(mockErrorElement.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('should use ERROR level by default', () => {
      // Act
      handler.displayError('Error');

      // Assert
      expect(mockErrorElement.className).toBe('error error-error');
    });

    it('should handle missing error element gracefully', () => {
      // Arrange
      document.getElementById.mockReturnValue(null);

      // Act & Assert - Should not throw
      expect(() => {
        handler.displayError('Error');
      }).not.toThrow();

      expect(logMessage).toHaveBeenCalledWith(
        expect.stringContaining('Error display element #error not found'),
        'warning'
      );
    });

    it('should handle different severity levels', () => {
      // Act
      handler.displayError('Info', ErrorLevel.INFO);
      expect(mockErrorElement.className).toBe('error error-info');

      handler.displayError('Critical', ErrorLevel.CRITICAL);
      expect(mockErrorElement.className).toBe('error error-critical');
    });
  });

  // ============================================================================
  // clearError()
  // ============================================================================

  describe('clearError()', () => {
    it('should clear error message', () => {
      // Arrange
      mockErrorElement.textContent = 'Previous error';

      // Act
      handler.clearError();

      // Assert
      expect(mockErrorElement.textContent).toBe('');
    });

    it('should reset error class to hidden', () => {
      // Arrange
      mockErrorElement.className = 'error error-critical';

      // Act
      handler.clearError();

      // Assert
      expect(mockErrorElement.className).toBe('error hidden');
    });

    it('should handle missing error element gracefully', () => {
      // Arrange
      document.getElementById.mockReturnValue(null);

      // Act & Assert - Should not throw
      expect(() => {
        handler.clearError();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // registerGlobalHandlers()
  // ============================================================================

  describe('registerGlobalHandlers()', () => {
    it('should register window error handler', () => {
      // Arrange
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      // Act
      handler.registerGlobalHandlers();

      // Assert
      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should register unhandledrejection handler', () => {
      // Arrange
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      // Act
      handler.registerGlobalHandlers();

      // Assert
      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    it('should handle uncaught errors', () => {
      // Arrange
      let errorCallback;
      vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
        if (event === 'error') {
          errorCallback = callback;
        }
      });
      handler.registerGlobalHandlers();

      const mockEvent = {
        error: new Error('Uncaught error'),
        filename: 'test.js',
        lineno: 42,
        colno: 10,
        preventDefault: vi.fn(),
      };

      // Act
      errorCallback(mockEvent);

      // Assert
      expect(handler.errorHistory.length).toBe(1);
      expect(handler.errorHistory[0].message).toBe('Uncaught error');
      expect(handler.errorHistory[0].level).toBe(ErrorLevel.CRITICAL);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should handle unhandled promise rejections', () => {
      // Arrange
      let rejectionCallback;
      vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
        if (event === 'unhandledrejection') {
          rejectionCallback = callback;
        }
      });
      handler.registerGlobalHandlers();

      const mockEvent = {
        reason: new Error('Promise rejection'),
        promise: Promise.reject(),
        preventDefault: vi.fn(),
      };

      // Act
      rejectionCallback(mockEvent);

      // Assert
      expect(handler.errorHistory.length).toBe(1);
      expect(handler.errorHistory[0].message).toBe('Promise rejection');
      expect(handler.errorHistory[0].level).toBe(ErrorLevel.CRITICAL);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should log registration success', () => {
      // Act
      handler.registerGlobalHandlers();

      // Assert
      expect(logMessage).toHaveBeenCalledWith('Global error handlers registered', 'info');
    });
  });

  // ============================================================================
  // wrapAsync()
  // ============================================================================

  describe('wrapAsync()', () => {
    it('should wrap async function successfully', async () => {
      // Arrange
      const asyncFn = vi.fn(async () => 'success');
      const wrapped = handler.wrapAsync(asyncFn);

      // Act
      const result = await wrapped();

      // Assert
      expect(result).toBe('success');
      expect(asyncFn).toHaveBeenCalled();
    });

    it('should handle errors in wrapped function', async () => {
      // Arrange
      const error = new Error('Async error');
      const asyncFn = vi.fn(async () => {
        throw error;
      });
      const wrapped = handler.wrapAsync(asyncFn, { function: 'test' });

      // Act & Assert
      await expect(wrapped('arg1', 'arg2')).rejects.toThrow('Async error');

      expect(handler.errorHistory.length).toBe(1);
      expect(handler.errorHistory[0].message).toBe('Async error');
      expect(handler.errorHistory[0].context).toMatchObject({
        function: 'test',
        args: ['arg1', 'arg2'],
      });
    });

    it('should pass arguments to wrapped function', async () => {
      // Arrange
      const asyncFn = vi.fn(async (a, b) => a + b);
      const wrapped = handler.wrapAsync(asyncFn);

      // Act
      const result = await wrapped(5, 10);

      // Assert
      expect(result).toBe(15);
      expect(asyncFn).toHaveBeenCalledWith(5, 10);
    });

    it('should include context in error handling', async () => {
      // Arrange
      const asyncFn = async () => {
        throw new Error('Test error');
      };
      const context = { operation: 'testOp', id: 'abc' };
      const wrapped = handler.wrapAsync(asyncFn, context);

      // Act & Assert
      await expect(wrapped()).rejects.toThrow();

      expect(handler.errorHistory[0].context).toMatchObject({
        operation: 'testOp',
        id: 'abc',
      });
    });
  });

  // ============================================================================
  // retryWithBackoff() - Successful execution
  // ============================================================================

  describe('retryWithBackoff() - Successful execution', () => {
    // Note: Tests use real timers with minimal delays to avoid unhandled
    // rejection issues that occur with fake timers + async rejections

    it('should return result on first successful attempt', async () => {
      // Arrange
      const fn = vi.fn(async () => 'success');

      // Act
      const result = await handler.retryWithBackoff(fn);

      // Assert
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      // Arrange - use implementation instead of mockRejectedValueOnce to avoid
      // unhandled rejection warnings from vitest's promise tracking
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Attempt 1 failed'));
        }
        return Promise.resolve('success');
      });

      // Act - use minimal delays with real timers
      const result = await handler.retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelay: 1,
        maxDelay: 1,
      });

      // Assert
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff delays', async () => {
      // Arrange - track actual delays via onRetry
      const delays = [];
      const onRetry = (_attempt, delay) => delays.push(delay);
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error(`Fail ${callCount}`));
        }
        return Promise.resolve('success');
      });

      // Act - use small baseDelay to verify exponential pattern
      const result = await handler.retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100,
        onRetry,
      });

      // Assert - delays should follow exponential pattern: 10, 20 (2^0*10, 2^1*10)
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(delays[0]).toBe(10); // 2^0 * 10
      expect(delays[1]).toBe(20); // 2^1 * 10
    });

    it('should cap delay at maxDelay', async () => {
      // Arrange - track actual delays via onRetry
      const delays = [];
      const onRetry = (_attempt, delay) => delays.push(delay);
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error(`Fail ${callCount}`));
        }
        return Promise.resolve('success');
      });

      // Act - use small delays to verify capping
      const result = await handler.retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 15, // Cap at 15ms
        onRetry,
      });

      // Assert - second delay should be capped
      expect(result).toBe('success');
      expect(delays[0]).toBe(10); // 2^0 * 10 = 10
      expect(delays[1]).toBe(15); // 2^1 * 10 = 20, but capped at 15
    });
  });

  // ============================================================================
  // retryWithBackoff() - Failure and callbacks
  // ============================================================================

  describe('retryWithBackoff() - Failure and callbacks', () => {
    // Note: These tests use real timers with minimal delays to avoid
    // unhandled rejection issues that occur with fake timers + async rejections

    it('should throw error after all retries exhausted', async () => {
      // Arrange
      const error = new Error('Persistent failure');
      const fn = vi.fn().mockRejectedValue(error);

      // Act - use minimal delays with real timers
      await expect(
        handler.retryWithBackoff(fn, { maxRetries: 2, baseDelay: 1, maxDelay: 1 })
      ).rejects.toThrow('Persistent failure');

      // Assert
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should call onRetry callback on each retry', async () => {
      // Arrange - use mockImplementation to avoid unhandled rejection warnings
      const onRetry = vi.fn();
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error(`Fail ${callCount}`));
        }
        return Promise.resolve('success');
      });

      // Act - use minimal delays with real timers
      const result = await handler.retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelay: 1,
        maxDelay: 1,
        onRetry,
      });

      // Assert
      expect(result).toBe('success');
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, 1, expect.any(Error));
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, 1, expect.any(Error));
    });

    it('should log retry attempts', async () => {
      // Arrange - use mockImplementation to avoid unhandled rejection warnings
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve('success');
      });

      // Act - use minimal delays with real timers
      await handler.retryWithBackoff(fn, { maxRetries: 2, baseDelay: 1, maxDelay: 1 });

      // Assert
      expect(logMessage).toHaveBeenCalledWith(
        expect.stringContaining('Retry 1/2 after 1ms: Network error'),
        'warning'
      );
    });

    it('should add final error to history after all retries', async () => {
      // Arrange
      const fn = vi.fn().mockRejectedValue(new Error('Failed'));

      // Act - use minimal delays with real timers
      await expect(
        handler.retryWithBackoff(fn, { maxRetries: 1, baseDelay: 1, maxDelay: 1 })
      ).rejects.toThrow('Failed');

      // Assert
      expect(handler.errorHistory.length).toBe(1);
      expect(handler.errorHistory[0].message).toBe('Failed');
      expect(handler.errorHistory[0].context.retries).toBe(1);
    });
  });

  // ============================================================================
  // getHistory()
  // ============================================================================

  describe('getHistory()', () => {
    it('should return all error history', () => {
      // Arrange
      handler.handleError(new Error('Error 1'));
      handler.handleError(new Error('Error 2'), {}, ErrorLevel.WARNING);
      handler.handleError(new Error('Error 3'), {}, ErrorLevel.CRITICAL);

      // Act
      const history = handler.getHistory();

      // Assert
      expect(history.length).toBe(3);
    });

    it('should filter by error level', () => {
      // Arrange
      handler.handleError(new Error('Error 1'), {}, ErrorLevel.ERROR);
      handler.handleError(new Error('Warning 1'), {}, ErrorLevel.WARNING);
      handler.handleError(new Error('Error 2'), {}, ErrorLevel.ERROR);

      // Act
      const errors = handler.getHistory(ErrorLevel.ERROR);

      // Assert
      expect(errors.length).toBe(2);
      expect(errors[0].message).toBe('Error 1');
      expect(errors[1].message).toBe('Error 2');
    });

    it('should return copy of history array', () => {
      // Arrange
      handler.handleError(new Error('Test'));

      // Act
      const history = handler.getHistory();
      history.push({ message: 'Fake entry' });

      // Assert
      expect(handler.errorHistory.length).toBe(1);
    });

    it('should return empty array when no errors', () => {
      // Act
      const history = handler.getHistory();

      // Assert
      expect(history).toEqual([]);
    });

    it('should filter CRITICAL errors only', () => {
      // Arrange
      handler.handleError('Error', {}, ErrorLevel.ERROR);
      handler.handleError('Critical 1', {}, ErrorLevel.CRITICAL);
      handler.handleError('Warning', {}, ErrorLevel.WARNING);
      handler.handleError('Critical 2', {}, ErrorLevel.CRITICAL);

      // Act
      const critical = handler.getHistory(ErrorLevel.CRITICAL);

      // Assert
      expect(critical.length).toBe(2);
      expect(critical[0].message).toBe('Critical 1');
      expect(critical[1].message).toBe('Critical 2');
    });
  });

  // ============================================================================
  // onError() and offError()
  // ============================================================================

  describe('onError() and offError()', () => {
    it('should register error callback', () => {
      // Arrange
      const callback = vi.fn();

      // Act
      handler.onError('test-callback', callback);

      // Assert
      expect(handler.errorCallbacks.has('test-callback')).toBe(true);
    });

    it('should unregister error callback', () => {
      // Arrange
      const callback = vi.fn();
      handler.onError('test-callback', callback);

      // Act
      handler.offError('test-callback');

      // Assert
      expect(handler.errorCallbacks.has('test-callback')).toBe(false);
    });

    it('should not trigger unregistered callbacks', () => {
      // Arrange
      const callback = vi.fn();
      handler.onError('test-callback', callback);
      handler.offError('test-callback');

      // Act
      handler.handleError(new Error('Test'));

      // Assert
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      // Arrange
      const badCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      handler.onError('bad-callback', badCallback);

      // Act & Assert - Should not throw
      expect(() => {
        handler.handleError(new Error('Test'));
      }).not.toThrow();

      expect(logMessage).toHaveBeenCalledWith(
        expect.stringContaining("Error in callback 'bad-callback'"),
        'error'
      );
    });
  });

  // ============================================================================
  // clearHistory()
  // ============================================================================

  describe('clearHistory()', () => {
    it('should clear all error history', () => {
      // Arrange
      handler.handleError(new Error('Error 1'));
      handler.handleError(new Error('Error 2'));
      expect(handler.errorHistory.length).toBe(2);

      // Act
      handler.clearHistory();

      // Assert
      expect(handler.errorHistory).toEqual([]);
    });

    it('should allow new errors after clearing', () => {
      // Arrange
      handler.handleError(new Error('Old error'));
      handler.clearHistory();

      // Act
      handler.handleError(new Error('New error'));

      // Assert
      expect(handler.errorHistory.length).toBe(1);
      expect(handler.errorHistory[0].message).toBe('New error');
    });
  });

  // ============================================================================
  // ErrorLevel enum
  // ============================================================================

  describe('ErrorLevel enum', () => {
    it('should have all severity levels', () => {
      expect(ErrorLevel.INFO).toBe('info');
      expect(ErrorLevel.WARNING).toBe('warning');
      expect(ErrorLevel.ERROR).toBe('error');
      expect(ErrorLevel.CRITICAL).toBe('critical');
    });

    it('should be frozen (immutable)', () => {
      // Act & Assert
      expect(() => {
        ErrorLevel.NEW_LEVEL = 'new';
      }).toThrow();
    });
  });

  // ============================================================================
  // Singleton instance
  // ============================================================================

  describe('errorHandler singleton', () => {
    it('should export singleton instance', () => {
      expect(errorHandler).toBeInstanceOf(ErrorHandler);
    });

    it('should have initialized properties', () => {
      expect(errorHandler.errorHistory).toBeDefined();
      expect(errorHandler.errorCallbacks).toBeDefined();
    });
  });

  // ============================================================================
  // Legacy exports
  // ============================================================================

  describe('Legacy exports', () => {
    it('displayError should call errorHandler.displayError', () => {
      // Arrange
      vi.spyOn(errorHandler, 'displayError');

      // Act
      displayError('Legacy error');

      // Assert
      expect(errorHandler.displayError).toHaveBeenCalledWith('Legacy error', ErrorLevel.ERROR);
    });

    it('clearError should call errorHandler.clearError', () => {
      // Arrange
      vi.spyOn(errorHandler, 'clearError');

      // Act
      clearError();

      // Assert
      expect(errorHandler.clearError).toHaveBeenCalled();
    });
  });
});
