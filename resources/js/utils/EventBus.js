// frontend/resources/js/utils/EventBus.js

/**
 * EventBus - Central event communication system
 *
 * Purpose: Decouples components by allowing them to communicate via events
 * instead of direct function calls. This implements the Observer pattern.
 *
 * Benefits:
 * - Loose coupling: Components don't need to know about each other
 * - Single Responsibility: Each component focuses on its own logic
 * - Testability: Easy to test components in isolation
 * - Extensibility: Add new listeners without modifying emitters
 *
 * SOLID Principles:
 * - Dependency Inversion: Depend on events (abstraction), not concrete classes
 * - Open/Closed: Open for extension (add listeners), closed for modification
 *
 * @class EventBus
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();

    /** @type {Map<string, Array>} - Event history for debugging */
    this.eventHistory = [];

    /** @type {number} - Max history entries to keep */
    this.maxHistory = 100;

    /** @type {boolean} - Enable debug logging */
    this.debug = false;
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  on(event, callback, options = {}) {
    if (typeof event !== 'string' || !event) {
      throw new Error('Event name must be a non-empty string');
    }

    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const listeners = this.listeners.get(event);

    // Wrap callback if once option is set
    const wrappedCallback = options.once
      ? (...args) => {
          callback(...args);
          this.off(event, wrappedCallback);
        }
      : callback;

    listeners.add(wrappedCallback);

    if (this.debug) {
      console.log(`[EventBus] Subscribed to "${event}"`, {
        listeners: listeners.size,
        once: options.once,
      });
    }

    // Return unsubscribe function
    return () => this.off(event, wrappedCallback);
  }

  /**
   * Subscribe to an event once (auto-unsubscribe after first call)
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    return this.on(event, callback, { once: true });
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);

      // Clean up empty event sets
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }

      if (this.debug) {
        console.log(`[EventBus] Unsubscribed from "${event}"`, {
          remainingListeners: listeners.size,
        });
      }
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name
   * @param {...*} args - Arguments to pass to listeners
   * @returns {number} Number of listeners notified
   */
  emit(event, ...args) {
    const listeners = this.listeners.get(event);
    let notifiedCount = 0;

    if (listeners && listeners.size > 0) {
      // Create array copy to avoid issues if listener modifies the set
      const listenersArray = Array.from(listeners);

      for (const callback of listenersArray) {
        try {
          callback(...args);
          notifiedCount++;
        } catch (error) {
          console.error(`[EventBus] Error in listener for "${event}":`, error);
          // Don't stop execution if one listener fails
        }
      }
    }

    // Record in history
    this._recordEvent(event, args, notifiedCount);

    if (this.debug) {
      console.log(`[EventBus] Emitted "${event}"`, {
        args,
        listeners: notifiedCount,
      });
    }

    return notifiedCount;
  }

  /**
   * Emit an event asynchronously
   * @param {string} event - Event name
   * @param {...*} args - Arguments to pass to listeners
   * @returns {Promise<number>} Number of listeners notified
   */
  async emitAsync(event, ...args) {
    const listeners = this.listeners.get(event);
    let notifiedCount = 0;

    if (listeners && listeners.size > 0) {
      const listenersArray = Array.from(listeners);

      for (const callback of listenersArray) {
        try {
          await callback(...args);
          notifiedCount++;
        } catch (error) {
          console.error(`[EventBus] Error in async listener for "${event}":`, error);
        }
      }
    }

    this._recordEvent(event, args, notifiedCount);

    if (this.debug) {
      console.log(`[EventBus] Emitted async "${event}"`, {
        args,
        listeners: notifiedCount,
      });
    }

    return notifiedCount;
  }

  /**
   * Remove all listeners for an event, or all events if no event specified
   * @param {string} [event] - Event name (optional)
   */
  clear(event) {
    if (event) {
      this.listeners.delete(event);
      if (this.debug) {
        console.log(`[EventBus] Cleared all listeners for "${event}"`);
      }
    } else {
      const count = this.listeners.size;
      this.listeners.clear();
      if (this.debug) {
        console.log(`[EventBus] Cleared all ${count} event listeners`);
      }
    }
  }

  /**
   * Get number of listeners for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    const listeners = this.listeners.get(event);
    return listeners ? listeners.size : 0;
  }

  /**
   * Get all event names that have listeners
   * @returns {string[]} Array of event names
   */
  eventNames() {
    return Array.from(this.listeners.keys());
  }

  /**
   * Record event in history for debugging
   * @private
   */
  _recordEvent(event, args, listenerCount) {
    this.eventHistory.push({
      event,
      args,
      listenerCount,
      timestamp: Date.now(),
    });

    // Trim history if too long
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get event history
   * @param {number} [limit] - Number of recent events to return
   * @returns {Array} Event history
   */
  getHistory(limit) {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Debug mode enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
    console.log(`[EventBus] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Create and export singleton instance
export const eventBus = new EventBus();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.__eventBus = eventBus;
}
