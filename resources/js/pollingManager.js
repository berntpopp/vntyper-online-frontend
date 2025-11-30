// frontend/resources/js/pollingManager.js

import { logMessage } from './log.js';

/**
 * Manages polling operations with deduplication and proper cleanup
 *
 * Problem: Multiple setTimeout calls without handle storage, infinite error retries,
 * race conditions when starting same poll twice.
 *
 * Solution: Centralized polling manager that:
 * - Prevents duplicate polls for same ID
 * - Stores timeout handles for proper cancellation
 * - Implements max retries and exponential backoff
 * - Ensures complete cleanup on stop
 *
 * @class PollingManager
 */
export class PollingManager {
  constructor() {
    // Active polls: id -> { stop, timeoutHandle, status, startedAt, retries }
    this.activePolls = new Map();
  }

  /**
   * Start polling with automatic deduplication
   * @param {string} id - Unique poll ID (e.g., 'job-123', 'cohort-abc')
   * @param {Function} pollFn - Async function to poll (should return { status, ...data })
   * @param {Object} options - Polling options
   * @returns {Function} - Stop function
   *
   * @example
   * const stop = pollingManager.start('job-123', async () => {
   *   const response = await fetch('/api/job-status/123');
   *   return await response.json();
   * }, {
   *   interval: 5000,
   *   maxRetries: 10,
   *   onUpdate: (data) => console.log('Status:', data.status),
   *   onComplete: (data) => console.log('Done!', data),
   *   onError: (error) => console.error('Poll error:', error)
   * });
   */
  start(id, pollFn, options = {}) {
    const {
      interval = 5000,
      maxRetries = 10,
      maxDuration = 3600000, // 1 hour max
      onUpdate = null,
      onComplete = null,
      onError = null,
    } = options;

    // If already polling, return existing stop function
    if (this.activePolls.has(id)) {
      logMessage(`Already polling ${id}, returning existing stop function`, 'warning');
      return this.activePolls.get(id).stop;
    }

    let isPolling = true;
    let retries = 0;
    let timeoutHandle = null;
    const startedAt = Date.now();

    /**
     * Stop function - completely stops polling
     */
    const stop = () => {
      isPolling = false;

      // Clear timeout if exists
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      // Remove from active polls
      this.activePolls.delete(id);

      const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
      logMessage(`Stopped polling ${id} (ran for ${duration}s)`, 'info');
    };

    /**
     * Main polling function
     */
    const poll = async () => {
      if (!isPolling) return;

      // Check max duration
      const elapsed = Date.now() - startedAt;
      if (elapsed > maxDuration) {
        logMessage(`Polling ${id} exceeded max duration (${maxDuration}ms)`, 'warning');
        stop();
        if (onError) {
          onError(new Error('Polling duration exceeded'));
        }
        return;
      }

      try {
        const result = await pollFn();

        // Update poll info
        const pollInfo = this.activePolls.get(id);
        if (pollInfo) {
          pollInfo.lastResult = result;
          pollInfo.lastPollAt = Date.now();
          pollInfo.retries = retries;
        }

        // Notify update callback
        if (onUpdate) {
          onUpdate(result);
        }

        // Check if polling should stop
        if (result.status === 'completed' || result.status === 'failed') {
          if (onComplete) {
            onComplete(result);
          }
          stop();
          return;
        }

        // Success - reset retries and schedule next poll
        retries = 0;
        timeoutHandle = setTimeout(poll, interval);
      } catch (error) {
        retries++;

        // Log error with context
        logMessage(
          `Polling error for ${id}: ${error.message} (retry ${retries}/${maxRetries})`,
          'error'
        );

        // Notify error callback
        if (onError) {
          onError(error);
        }

        // Check if should keep retrying
        if (retries >= maxRetries) {
          logMessage(`Polling ${id} failed after ${maxRetries} retries`, 'error');
          stop();
          return;
        }

        // Exponential backoff: delay = interval * 2^retries, capped at 60s
        const backoffDelay = Math.min(interval * Math.pow(2, retries), 60000);
        logMessage(
          `Polling ${id} retry ${retries}/${maxRetries} after ${backoffDelay}ms`,
          'warning'
        );

        timeoutHandle = setTimeout(poll, backoffDelay);
      }
    };

    // Store polling info
    this.activePolls.set(id, {
      stop,
      timeoutHandle,
      status: 'active',
      startedAt,
      retries,
      lastPollAt: null,
      lastResult: null,
    });

    // Start polling immediately
    poll();

    logMessage(
      `Started polling ${id} (interval: ${interval}ms, maxRetries: ${maxRetries})`,
      'info'
    );

    return stop;
  }

  /**
   * Stop specific poll
   * @param {string} id - Poll ID
   * @returns {boolean} - True if stopped, false if not found
   */
  stop(id) {
    const poll = this.activePolls.get(id);
    if (poll) {
      poll.stop();
      return true;
    }
    return false;
  }

  /**
   * Stop all active polls
   * @returns {number} - Number of polls stopped
   */
  stopAll() {
    const count = this.activePolls.size;

    for (const [_id, poll] of this.activePolls.entries()) {
      poll.stop();
    }

    if (count > 0) {
      logMessage(`Stopped ${count} active polls`, 'info');
    }

    return count;
  }

  /**
   * Check if poll is active
   * @param {string} id - Poll ID
   * @returns {boolean} - True if active
   */
  isActive(id) {
    return this.activePolls.has(id);
  }

  /**
   * Get active poll IDs
   * @returns {string[]} - Array of active poll IDs
   */
  getActive() {
    return Array.from(this.activePolls.keys());
  }

  /**
   * Get poll information
   * @param {string} id - Poll ID
   * @returns {Object|null} - Poll info or null
   */
  getPollInfo(id) {
    const poll = this.activePolls.get(id);
    if (!poll) return null;

    return {
      id,
      status: poll.status,
      startedAt: poll.startedAt,
      runningFor: Date.now() - poll.startedAt,
      retries: poll.retries,
      lastPollAt: poll.lastPollAt,
      lastResult: poll.lastResult,
    };
  }

  /**
   * Get all poll information
   * @returns {Array} - Array of poll info objects
   */
  getAllPollInfo() {
    return this.getActive().map(id => this.getPollInfo(id));
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    this.stopAll();
  }
}

// Create singleton instance
export const pollingManager = new PollingManager();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  pollingManager.cleanup();
});
