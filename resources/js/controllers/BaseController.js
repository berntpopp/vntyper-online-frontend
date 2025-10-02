// frontend/resources/js/controllers/BaseController.js

/**
 * Base Controller Class
 *
 * Purpose: Provides common functionality for all controllers, implementing
 * the Template Method pattern and establishing a consistent controller interface.
 *
 * Benefits:
 * - DRY: Common logic in one place
 * - Consistency: All controllers follow same lifecycle
 * - Maintainability: Easy to add cross-cutting concerns
 * - Testability: Common test helpers
 *
 * SOLID Principles:
 * - Single Responsibility: Handles controller lifecycle and event binding
 * - Open/Closed: Subclasses extend without modifying base
 * - Liskov Substitution: Subclasses can replace base without breaking code
 * - Interface Segregation: Only essential methods in base class
 * - Dependency Inversion: Depends on EventBus abstraction
 *
 * Lifecycle:
 * 1. constructor() - Initialize dependencies
 * 2. initialize() - Setup (optional override)
 * 3. bindEvents() - Register event listeners (must override)
 * 4. destroy() - Cleanup (optional override)
 *
 * @class BaseController
 */
export class BaseController {
    /**
     * @param {Object} dependencies - Injected dependencies
     * @param {EventBus} dependencies.eventBus - Event bus for pub/sub
     * @param {StateManager} dependencies.stateManager - State manager
     * @param {Logger} [dependencies.logger] - Logger instance
     */
    constructor(dependencies) {
        // Validate required dependencies
        if (!dependencies || typeof dependencies !== 'object') {
            throw new Error(`${this.constructor.name}: dependencies object is required`);
        }

        if (!dependencies.eventBus) {
            throw new Error(`${this.constructor.name}: eventBus dependency is required`);
        }

        if (!dependencies.stateManager) {
            throw new Error(`${this.constructor.name}: stateManager dependency is required`);
        }

        // Store dependencies
        this.eventBus = dependencies.eventBus;
        this.stateManager = dependencies.stateManager;
        this.logger = dependencies.logger || console;

        // Track event subscriptions for cleanup
        this.eventSubscriptions = [];

        // Controller state
        this.isInitialized = false;
        this.isDestroyed = false;

        // Call lifecycle methods
        this.initialize();
        this.bindEvents();

        this.isInitialized = true;
        this._log('Controller initialized', 'info');
    }

    /**
     * Initialize controller (override in subclass if needed)
     * Template Method pattern - subclasses can extend
     */
    initialize() {
        // Subclasses can override to add initialization logic
    }

    /**
     * Bind event listeners (must override in subclass)
     * Template Method pattern - subclasses must implement
     */
    bindEvents() {
        // Subclasses must override to bind their events
        // throw new Error(`${this.constructor.name}: bindEvents() must be implemented`);
    }

    /**
     * Subscribe to an event with automatic cleanup tracking
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} options - Subscription options
     * @returns {Function} Unsubscribe function
     */
    on(event, handler, options = {}) {
        // Bind handler to this controller context
        const boundHandler = handler.bind(this);

        // Subscribe to event
        const unsubscribe = this.eventBus.on(event, boundHandler, options);

        // Track for cleanup
        this.eventSubscriptions.push({
            event,
            unsubscribe
        });

        this._log(`Subscribed to event: ${event}`, 'debug');

        return unsubscribe;
    }

    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @returns {Function} Unsubscribe function
     */
    once(event, handler) {
        return this.on(event, handler, { once: true });
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {...*} args - Event arguments
     * @returns {number} Number of listeners notified
     */
    emit(event, ...args) {
        this._log(`Emitting event: ${event}`, 'debug', args);
        return this.eventBus.emit(event, ...args);
    }

    /**
     * Emit an event asynchronously
     * @param {string} event - Event name
     * @param {...*} args - Event arguments
     * @returns {Promise<number>} Number of listeners notified
     */
    async emitAsync(event, ...args) {
        this._log(`Emitting async event: ${event}`, 'debug', args);
        return this.eventBus.emitAsync(event, ...args);
    }

    /**
     * Get state value
     * @param {string} path - State path
     * @returns {*} State value
     */
    getState(path) {
        return this.stateManager.get(path);
    }

    /**
     * Set state value
     * @param {string} path - State path
     * @param {*} value - New value
     */
    setState(path, value) {
        this.stateManager.set(path, value);
    }

    /**
     * Handle errors consistently
     * @param {Error} error - Error object
     * @param {string} context - Error context
     */
    handleError(error, context = '') {
        const message = context ? `${context}: ${error.message}` : error.message;

        this._log(message, 'error', error);

        // Emit error event for centralized error handling
        this.emit('error', {
            controller: this.constructor.name,
            context,
            error,
            message
        });
    }

    /**
     * Destroy controller and cleanup resources
     * Template Method pattern - subclasses can extend
     */
    destroy() {
        if (this.isDestroyed) {
            this._log('Already destroyed', 'warning');
            return;
        }

        // Unsubscribe from all events
        for (const subscription of this.eventSubscriptions) {
            subscription.unsubscribe();
        }
        this.eventSubscriptions = [];

        // Call subclass cleanup
        this.cleanup();

        this.isDestroyed = true;
        this.isInitialized = false;

        this._log('Controller destroyed', 'info');
    }

    /**
     * Cleanup resources (override in subclass if needed)
     * Template Method pattern - subclasses can extend
     */
    cleanup() {
        // Subclasses can override to add cleanup logic
    }

    /**
     * Log message with controller context
     * @private
     */
    _log(message, level = 'info', ...args) {
        const prefix = `[${this.constructor.name}]`;

        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](prefix, message, ...args);
        } else if (typeof this.logger.logMessage === 'function') {
            // Support custom logger interface (like our log.js)
            this.logger.logMessage(`${prefix} ${message}`, level);
        }
    }

    /**
     * Check if controller is ready
     * @returns {boolean} True if initialized and not destroyed
     */
    isReady() {
        return this.isInitialized && !this.isDestroyed;
    }

    /**
     * Get controller info
     * @returns {Object} Controller info
     */
    getInfo() {
        return {
            name: this.constructor.name,
            initialized: this.isInitialized,
            destroyed: this.isDestroyed,
            subscriptions: this.eventSubscriptions.length
        };
    }
}
