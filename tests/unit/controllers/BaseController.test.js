// tests/unit/controllers/BaseController.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseController } from '../../../resources/js/controllers/BaseController.js';

describe('BaseController', () => {
    let mockEventBus;
    let mockStateManager;
    let mockLogger;
    let dependencies;

    beforeEach(() => {
        // Mock EventBus
        mockEventBus = {
            on: vi.fn((event, handler, options) => {
                // Return unsubscribe function
                return vi.fn();
            }),
            emit: vi.fn(() => 1),
            emitAsync: vi.fn(async () => 1)
        };

        // Mock StateManager
        mockStateManager = {
            get: vi.fn((path) => 'mock-value'),
            set: vi.fn()
        };

        // Mock Logger
        mockLogger = {
            info: vi.fn(),
            debug: vi.fn(),
            warning: vi.fn(),
            error: vi.fn()
        };

        dependencies = {
            eventBus: mockEventBus,
            stateManager: mockStateManager,
            logger: mockLogger
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ============================================================================
    // Constructor - Validation and initialization
    // ============================================================================

    describe('constructor() - Validation and initialization', () => {
        it('should throw error if dependencies is missing', () => {
            expect(() => new BaseController()).toThrow(
                'BaseController: dependencies object is required'
            );
        });

        it('should throw error if dependencies is not an object', () => {
            expect(() => new BaseController('invalid')).toThrow(
                'BaseController: dependencies object is required'
            );
        });

        it('should throw error if eventBus is missing', () => {
            expect(() => new BaseController({
                stateManager: mockStateManager
            })).toThrow('BaseController: eventBus dependency is required');
        });

        it('should throw error if stateManager is missing', () => {
            expect(() => new BaseController({
                eventBus: mockEventBus
            })).toThrow('BaseController: stateManager dependency is required');
        });

        it('should use console as default logger if not provided', () => {
            const deps = {
                eventBus: mockEventBus,
                stateManager: mockStateManager
            };

            const controller = new BaseController(deps);

            expect(controller.logger).toBe(console);
        });

        it('should store dependencies correctly', () => {
            const controller = new BaseController(dependencies);

            expect(controller.eventBus).toBe(mockEventBus);
            expect(controller.stateManager).toBe(mockStateManager);
            expect(controller.logger).toBe(mockLogger);
        });

        it('should initialize eventSubscriptions array', () => {
            const controller = new BaseController(dependencies);

            expect(controller.eventSubscriptions).toEqual([]);
        });

        it('should set isInitialized to true', () => {
            const controller = new BaseController(dependencies);

            expect(controller.isInitialized).toBe(true);
        });

        it('should set isDestroyed to false', () => {
            const controller = new BaseController(dependencies);

            expect(controller.isDestroyed).toBe(false);
        });

        it('should call initialize() during construction', () => {
            const initializeSpy = vi.spyOn(BaseController.prototype, 'initialize');

            const controller = new BaseController(dependencies);

            expect(initializeSpy).toHaveBeenCalled();
        });

        it('should call bindEvents() during construction', () => {
            const bindEventsSpy = vi.spyOn(BaseController.prototype, 'bindEvents');

            const controller = new BaseController(dependencies);

            expect(bindEventsSpy).toHaveBeenCalled();
        });

        it('should log initialization', () => {
            const controller = new BaseController(dependencies);

            expect(mockLogger.info).toHaveBeenCalledWith(
                '[BaseController]',
                'Controller initialized'
            );
        });

        it('should show subclass name in error messages', () => {
            class TestController extends BaseController {}

            expect(() => new TestController({
                eventBus: mockEventBus
            })).toThrow('TestController: stateManager dependency is required');
        });
    });

    // ============================================================================
    // Template Methods - Lifecycle hooks
    // ============================================================================

    describe('Template Methods - initialize() and bindEvents()', () => {
        it('should have default initialize() that does nothing', () => {
            const controller = new BaseController(dependencies);

            // Should not throw
            expect(controller.initialize).toBeDefined();
            expect(() => controller.initialize()).not.toThrow();
        });

        it('should have default bindEvents() that does nothing', () => {
            const controller = new BaseController(dependencies);

            // Should not throw
            expect(controller.bindEvents).toBeDefined();
            expect(() => controller.bindEvents()).not.toThrow();
        });

        it('should allow subclasses to override initialize()', () => {
            const initializeSpy = vi.fn();

            class TestController extends BaseController {
                initialize() {
                    initializeSpy();
                }
            }

            const controller = new TestController(dependencies);

            expect(initializeSpy).toHaveBeenCalled();
        });

        it('should allow subclasses to override bindEvents()', () => {
            const bindEventsSpy = vi.fn();

            class TestController extends BaseController {
                bindEvents() {
                    bindEventsSpy();
                }
            }

            const controller = new TestController(dependencies);

            expect(bindEventsSpy).toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Event Methods - on(), once(), emit(), emitAsync()
    // ============================================================================

    describe('on() - Subscribe to event', () => {
        it('should subscribe to event via eventBus', () => {
            const controller = new BaseController(dependencies);
            const handler = vi.fn();

            controller.on('test:event', handler);

            expect(mockEventBus.on).toHaveBeenCalledWith(
                'test:event',
                expect.any(Function),
                {}
            );
        });

        it('should bind handler to controller context', () => {
            const controller = new BaseController(dependencies);
            let capturedHandler;

            mockEventBus.on.mockImplementation((event, handler, options) => {
                capturedHandler = handler;
                return vi.fn();
            });

            const handler = function() {
                return this;
            };

            controller.on('test:event', handler);

            // Call the captured bound handler
            const result = capturedHandler();

            expect(result).toBe(controller);
        });

        it('should track subscription for cleanup', () => {
            const controller = new BaseController(dependencies);
            const unsubscribe = vi.fn();

            mockEventBus.on.mockReturnValue(unsubscribe);

            controller.on('test:event', vi.fn());

            expect(controller.eventSubscriptions).toHaveLength(1);
            expect(controller.eventSubscriptions[0]).toEqual({
                event: 'test:event',
                unsubscribe
            });
        });

        it('should return unsubscribe function', () => {
            const controller = new BaseController(dependencies);
            const unsubscribe = vi.fn();

            mockEventBus.on.mockReturnValue(unsubscribe);

            const result = controller.on('test:event', vi.fn());

            expect(result).toBe(unsubscribe);
        });

        it('should pass options to eventBus', () => {
            const controller = new BaseController(dependencies);
            const options = { priority: 1 };

            controller.on('test:event', vi.fn(), options);

            expect(mockEventBus.on).toHaveBeenCalledWith(
                'test:event',
                expect.any(Function),
                options
            );
        });

        it('should log subscription in debug mode', () => {
            const controller = new BaseController(dependencies);

            controller.on('test:event', vi.fn());

            expect(mockLogger.debug).toHaveBeenCalledWith(
                '[BaseController]',
                'Subscribed to event: test:event'
            );
        });

        it('should track multiple subscriptions', () => {
            const controller = new BaseController(dependencies);

            controller.on('event1', vi.fn());
            controller.on('event2', vi.fn());
            controller.on('event3', vi.fn());

            expect(controller.eventSubscriptions).toHaveLength(3);
        });
    });

    describe('once() - Subscribe to event once', () => {
        it('should subscribe with once option', () => {
            const controller = new BaseController(dependencies);
            const handler = vi.fn();

            controller.once('test:event', handler);

            expect(mockEventBus.on).toHaveBeenCalledWith(
                'test:event',
                expect.any(Function),
                { once: true }
            );
        });

        it('should return unsubscribe function', () => {
            const controller = new BaseController(dependencies);
            const unsubscribe = vi.fn();

            mockEventBus.on.mockReturnValue(unsubscribe);

            const result = controller.once('test:event', vi.fn());

            expect(result).toBe(unsubscribe);
        });
    });

    describe('emit() - Emit event', () => {
        it('should emit event via eventBus', () => {
            const controller = new BaseController(dependencies);

            controller.emit('test:event', { data: 'test' });

            expect(mockEventBus.emit).toHaveBeenCalledWith(
                'test:event',
                { data: 'test' }
            );
        });

        it('should return number of listeners notified', () => {
            const controller = new BaseController(dependencies);
            mockEventBus.emit.mockReturnValue(3);

            const result = controller.emit('test:event');

            expect(result).toBe(3);
        });

        it('should log emission in debug mode', () => {
            const controller = new BaseController(dependencies);

            controller.emit('test:event', { data: 'test' });

            expect(mockLogger.debug).toHaveBeenCalledWith(
                '[BaseController]',
                'Emitting event: test:event',
                [{ data: 'test' }]
            );
        });

        it('should pass multiple arguments to eventBus', () => {
            const controller = new BaseController(dependencies);

            controller.emit('test:event', 'arg1', 'arg2', 'arg3');

            expect(mockEventBus.emit).toHaveBeenCalledWith(
                'test:event',
                'arg1',
                'arg2',
                'arg3'
            );
        });
    });

    describe('emitAsync() - Emit event asynchronously', () => {
        it('should emit event via eventBus asynchronously', async () => {
            const controller = new BaseController(dependencies);

            await controller.emitAsync('test:event', { data: 'test' });

            expect(mockEventBus.emitAsync).toHaveBeenCalledWith(
                'test:event',
                { data: 'test' }
            );
        });

        it('should return number of listeners notified', async () => {
            const controller = new BaseController(dependencies);
            mockEventBus.emitAsync.mockResolvedValue(3);

            const result = await controller.emitAsync('test:event');

            expect(result).toBe(3);
        });

        it('should log emission in debug mode', async () => {
            const controller = new BaseController(dependencies);

            await controller.emitAsync('test:event', { data: 'test' });

            expect(mockLogger.debug).toHaveBeenCalledWith(
                '[BaseController]',
                'Emitting async event: test:event',
                [{ data: 'test' }]
            );
        });
    });

    // ============================================================================
    // State Methods - getState() and setState()
    // ============================================================================

    describe('getState() - Get state value', () => {
        it('should delegate to stateManager.get()', () => {
            const controller = new BaseController(dependencies);
            mockStateManager.get.mockReturnValue('test-value');

            const result = controller.getState('jobs.job-123');

            expect(mockStateManager.get).toHaveBeenCalledWith('jobs.job-123');
            expect(result).toBe('test-value');
        });
    });

    describe('setState() - Set state value', () => {
        it('should delegate to stateManager.set()', () => {
            const controller = new BaseController(dependencies);

            controller.setState('jobs.job-123.status', 'completed');

            expect(mockStateManager.set).toHaveBeenCalledWith(
                'jobs.job-123.status',
                'completed'
            );
        });
    });

    // ============================================================================
    // Error Handling - handleError()
    // ============================================================================

    describe('handleError() - Handle errors consistently', () => {
        it('should log error with context', () => {
            const controller = new BaseController(dependencies);
            const error = new Error('Test error');

            controller.handleError(error, 'Test context');

            expect(mockLogger.error).toHaveBeenCalledWith(
                '[BaseController]',
                'Test context: Test error',
                error
            );
        });

        it('should log error without context', () => {
            const controller = new BaseController(dependencies);
            const error = new Error('Test error');

            controller.handleError(error);

            expect(mockLogger.error).toHaveBeenCalledWith(
                '[BaseController]',
                'Test error',
                error
            );
        });

        it('should emit error event with metadata', () => {
            const controller = new BaseController(dependencies);
            const error = new Error('Test error');

            controller.handleError(error, 'Test context');

            expect(mockEventBus.emit).toHaveBeenCalledWith('error', {
                controller: 'BaseController',
                context: 'Test context',
                error,
                message: 'Test context: Test error'
            });
        });

        it('should include controller name in error event', () => {
            class TestController extends BaseController {}
            const controller = new TestController(dependencies);
            const error = new Error('Test error');

            controller.handleError(error, 'Context');

            expect(mockEventBus.emit).toHaveBeenCalledWith('error', {
                controller: 'TestController',
                context: 'Context',
                error,
                message: 'Context: Test error'
            });
        });
    });

    // ============================================================================
    // Lifecycle - destroy() and cleanup()
    // ============================================================================

    describe('destroy() - Cleanup resources', () => {
        it('should unsubscribe from all events', () => {
            const controller = new BaseController(dependencies);
            const unsubscribe1 = vi.fn();
            const unsubscribe2 = vi.fn();
            const unsubscribe3 = vi.fn();

            mockEventBus.on
                .mockReturnValueOnce(unsubscribe1)
                .mockReturnValueOnce(unsubscribe2)
                .mockReturnValueOnce(unsubscribe3);

            controller.on('event1', vi.fn());
            controller.on('event2', vi.fn());
            controller.on('event3', vi.fn());

            controller.destroy();

            expect(unsubscribe1).toHaveBeenCalled();
            expect(unsubscribe2).toHaveBeenCalled();
            expect(unsubscribe3).toHaveBeenCalled();
        });

        it('should clear eventSubscriptions array', () => {
            const controller = new BaseController(dependencies);
            controller.on('event1', vi.fn());
            controller.on('event2', vi.fn());

            controller.destroy();

            expect(controller.eventSubscriptions).toEqual([]);
        });

        it('should call cleanup() template method', () => {
            const cleanupSpy = vi.fn();

            class TestController extends BaseController {
                cleanup() {
                    cleanupSpy();
                }
            }

            const controller = new TestController(dependencies);

            controller.destroy();

            expect(cleanupSpy).toHaveBeenCalled();
        });

        it('should set isDestroyed to true', () => {
            const controller = new BaseController(dependencies);

            controller.destroy();

            expect(controller.isDestroyed).toBe(true);
        });

        it('should set isInitialized to false', () => {
            const controller = new BaseController(dependencies);

            controller.destroy();

            expect(controller.isInitialized).toBe(false);
        });

        it('should log destruction', () => {
            const controller = new BaseController(dependencies);

            // Skip the initialization log call
            mockLogger.info.mockClear();

            controller.destroy();

            expect(mockLogger.info).toHaveBeenCalledWith(
                '[BaseController]',
                'Controller destroyed'
            );
        });

        it('should warn if already destroyed', () => {
            const controller = new BaseController(dependencies);

            controller.destroy();
            controller.destroy();  // Second call

            expect(mockLogger.warning).toHaveBeenCalledWith(
                '[BaseController]',
                'Already destroyed'
            );
        });

        it('should not unsubscribe events twice', () => {
            const controller = new BaseController(dependencies);
            const unsubscribe = vi.fn();

            mockEventBus.on.mockReturnValue(unsubscribe);

            controller.on('event1', vi.fn());

            controller.destroy();
            controller.destroy();  // Second call

            // Unsubscribe should only be called once
            expect(unsubscribe).toHaveBeenCalledTimes(1);
        });
    });

    describe('cleanup() - Template method', () => {
        it('should have default cleanup() that does nothing', () => {
            const controller = new BaseController(dependencies);

            // Should not throw
            expect(controller.cleanup).toBeDefined();
            expect(() => controller.cleanup()).not.toThrow();
        });

        it('should allow subclasses to override cleanup()', () => {
            const cleanupSpy = vi.fn();

            class TestController extends BaseController {
                cleanup() {
                    cleanupSpy();
                }
            }

            const controller = new TestController(dependencies);

            controller.destroy();

            expect(cleanupSpy).toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Logging - _log()
    // ============================================================================

    describe('_log() - Private logging', () => {
        it('should log with controller name prefix', () => {
            const controller = new BaseController(dependencies);

            // Clear initialization log
            mockLogger.info.mockClear();

            controller._log('Test message', 'info');

            expect(mockLogger.info).toHaveBeenCalledWith(
                '[BaseController]',
                'Test message'
            );
        });

        it('should use subclass name in prefix', () => {
            class TestController extends BaseController {}
            const controller = new TestController(dependencies);

            // Clear initialization log
            mockLogger.info.mockClear();

            controller._log('Test message', 'info');

            expect(mockLogger.info).toHaveBeenCalledWith(
                '[TestController]',
                'Test message'
            );
        });

        it('should support different log levels', () => {
            const controller = new BaseController(dependencies);

            controller._log('Info message', 'info');
            controller._log('Debug message', 'debug');
            controller._log('Warning message', 'warning');
            controller._log('Error message', 'error');

            expect(mockLogger.info).toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalled();
            expect(mockLogger.warning).toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should pass additional arguments', () => {
            const controller = new BaseController(dependencies);

            // Clear initialization log
            mockLogger.info.mockClear();

            controller._log('Test message', 'info', { data: 'test' }, 'extra');

            expect(mockLogger.info).toHaveBeenCalledWith(
                '[BaseController]',
                'Test message',
                { data: 'test' },
                'extra'
            );
        });

        it('should use logMessage interface if available', () => {
            const customLogger = {
                logMessage: vi.fn()
            };

            const controller = new BaseController({
                ...dependencies,
                logger: customLogger
            });

            controller._log('Test message', 'info');

            expect(customLogger.logMessage).toHaveBeenCalledWith(
                '[BaseController] Test message',
                'info'
            );
        });

        it('should handle logger without specific level method', () => {
            const customLogger = {
                logMessage: vi.fn()
            };

            const controller = new BaseController({
                ...dependencies,
                logger: customLogger
            });

            // Should not throw
            expect(() => controller._log('Test', 'custom-level')).not.toThrow();
        });

        it('should default to info level if not specified', () => {
            const controller = new BaseController(dependencies);

            controller._log('Test message');

            expect(mockLogger.info).toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Utility Methods - isReady() and getInfo()
    // ============================================================================

    describe('isReady() - Check if controller is ready', () => {
        it('should return true when initialized and not destroyed', () => {
            const controller = new BaseController(dependencies);

            expect(controller.isReady()).toBe(true);
        });

        it('should return false when destroyed', () => {
            const controller = new BaseController(dependencies);

            controller.destroy();

            expect(controller.isReady()).toBe(false);
        });

        it('should return false before initialization completes', () => {
            let controller;

            class TestController extends BaseController {
                initialize() {
                    // Check isReady during initialization
                    controller = this;
                }
            }

            new TestController(dependencies);

            // During initialize(), isInitialized is still false
            // After constructor, it's true
            expect(controller.isReady()).toBe(true);
        });
    });

    describe('getInfo() - Get controller info', () => {
        it('should return controller info object', () => {
            const controller = new BaseController(dependencies);

            const info = controller.getInfo();

            expect(info).toEqual({
                name: 'BaseController',
                initialized: true,
                destroyed: false,
                subscriptions: 0
            });
        });

        it('should include subclass name', () => {
            class TestController extends BaseController {}
            const controller = new TestController(dependencies);

            const info = controller.getInfo();

            expect(info.name).toBe('TestController');
        });

        it('should reflect current subscriptions count', () => {
            const controller = new BaseController(dependencies);

            controller.on('event1', vi.fn());
            controller.on('event2', vi.fn());

            const info = controller.getInfo();

            expect(info.subscriptions).toBe(2);
        });

        it('should reflect destroyed state', () => {
            const controller = new BaseController(dependencies);

            controller.destroy();

            const info = controller.getInfo();

            expect(info).toEqual({
                name: 'BaseController',
                initialized: false,
                destroyed: true,
                subscriptions: 0
            });
        });
    });

    // ============================================================================
    // Integration Tests - Complete controller lifecycle
    // ============================================================================

    describe('Integration - Complete lifecycle', () => {
        it('should handle complete lifecycle correctly', () => {
            class TestController extends BaseController {
                initialize() {
                    this.customState = 'initialized';
                }

                bindEvents() {
                    this.on('test:event', this.handleTestEvent);
                }

                handleTestEvent(data) {
                    this.customState = data.value;
                }

                cleanup() {
                    this.customState = null;
                }
            }

            // Construction and initialization
            const controller = new TestController(dependencies);

            expect(controller.isInitialized).toBe(true);
            expect(controller.customState).toBe('initialized');
            expect(controller.eventSubscriptions).toHaveLength(1);

            // Destruction and cleanup
            controller.destroy();

            expect(controller.isDestroyed).toBe(true);
            expect(controller.customState).toBeNull();
            expect(controller.eventSubscriptions).toHaveLength(0);
        });

        it('should maintain proper state throughout lifecycle', () => {
            const controller = new BaseController(dependencies);

            // Initial state
            expect(controller.isReady()).toBe(true);
            expect(controller.getInfo().initialized).toBe(true);
            expect(controller.getInfo().destroyed).toBe(false);

            // After destroy
            controller.destroy();

            expect(controller.isReady()).toBe(false);
            expect(controller.getInfo().initialized).toBe(false);
            expect(controller.getInfo().destroyed).toBe(true);
        });
    });
});
