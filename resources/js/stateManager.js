// frontend/resources/js/stateManager.js

import { logMessage } from './log.js';

/**
 * Centralized state management with reactive updates
 *
 * Problem: State scattered across 6+ modules with no single source of truth.
 * Changes in one place don't propagate to others, causing synchronization issues.
 *
 * Solution: Single state tree with event-driven updates. Components subscribe
 * to state changes and react automatically.
 *
 * Pattern: Observer pattern + Single source of truth
 *
 * @class StateManager
 */
export class StateManager {
  constructor() {
    // Single source of truth for all application state
    this.state = {
      // File selection
      selectedFiles: [],

      // Job tracking
      jobs: new Map(), // jobId -> { status, data, pollStop, ... }

      // Cohort tracking
      cohorts: new Map(), // cohortId -> { alias, jobs, ... }
      displayedCohorts: new Set(),

      // UI state
      countdown: {
        interval: null,
        timeLeft: 20,
        isActive: false,
        jobId: null, // Which job this countdown is for
      },

      spinner: {
        isActive: false,
        count: 0, // Allow nesting
      },

      // Aioli CLI instance
      cli: null,

      // Server monitoring
      serverLoad: {
        interval: null,
        data: null,
        lastUpdate: null,
      },
    };

    // Event listeners: eventName -> Set of callbacks
    this.listeners = new Map();

    // State change history for debugging
    this.history = [];
    this.maxHistory = 100;
  }

  /**
   * Get immutable copy of current state
   * @returns {Object} - Deep copy of state
   */
  getState() {
    // Simple deep clone (works for non-circular structures)
    return JSON.parse(
      JSON.stringify({
        selectedFiles: this.state.selectedFiles,
        jobs: Array.from(this.state.jobs.entries()),
        cohorts: Array.from(this.state.cohorts.entries()),
        displayedCohorts: Array.from(this.state.displayedCohorts),
        countdown: { ...this.state.countdown, interval: null }, // Don't clone interval
        spinner: { ...this.state.spinner },
        serverLoad: { ...this.state.serverLoad, interval: null },
      })
    );
  }

  /**
   * Get specific state value using dot notation
   * @param {string} path - Path to value (e.g., 'countdown.timeLeft')
   * @returns {*} - State value
   *
   * @example
   * const timeLeft = stateManager.get('countdown.timeLeft');
   */
  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }

  /**
   * Set state value and notify listeners
   * @param {string} path - Path to value (e.g., 'countdown.timeLeft')
   * @param {*} value - New value
   *
   * @example
   * stateManager.set('countdown.timeLeft', 15);
   * // Triggers 'countdown.timeLeft' event and generic 'state.changed' event
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => obj[key], this.state);

    const oldValue = target[lastKey];

    // Only update if value actually changed
    if (oldValue === value) {
      return;
    }

    target[lastKey] = value;

    // Record in history
    this.addToHistory({
      type: 'set',
      path,
      oldValue,
      newValue: value,
    });

    // Notify specific path listeners
    this.emit(path, value, oldValue);

    // Notify generic change listeners
    this.emit('state.changed', { path, value, oldValue });
  }

  /**
   * Add a job to tracking
   * @param {string} jobId - Job ID
   * @param {Object} data - Job data (status, files, etc.)
   */
  addJob(jobId, data) {
    this.state.jobs.set(jobId, {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    this.addToHistory({
      type: 'job.added',
      jobId,
      data,
    });

    this.emit('job.added', jobId, data);
    this.emit('jobs.changed');
  }

  /**
   * Update job data
   * @param {string} jobId - Job ID
   * @param {Object} updates - Fields to update
   */
  updateJob(jobId, updates) {
    const job = this.state.jobs.get(jobId);
    if (!job) {
      logMessage(`[StateManager] Job not found: ${jobId}`, 'warning');
      return;
    }

    Object.assign(job, updates, { updatedAt: Date.now() });

    this.addToHistory({
      type: 'job.updated',
      jobId,
      updates,
    });

    this.emit('job.updated', jobId, job);
    this.emit('jobs.changed');
  }

  /**
   * Remove a job from tracking
   * @param {string} jobId - Job ID
   */
  removeJob(jobId) {
    const job = this.state.jobs.get(jobId);
    if (!job) {
      return;
    }

    this.state.jobs.delete(jobId);

    this.addToHistory({
      type: 'job.removed',
      jobId,
    });

    this.emit('job.removed', jobId, job);
    this.emit('jobs.changed');
  }

  /**
   * Update job status (convenience method)
   * @param {string} jobId - Job ID
   * @param {string} status - New status
   */
  updateJobStatus(jobId, status) {
    this.updateJob(jobId, { status });
  }

  /**
   * Get a specific job
   * @param {string} jobId - Job ID
   * @returns {Object|null} - Job data or null
   */
  getJob(jobId) {
    return this.state.jobs.get(jobId) || null;
  }

  /**
   * Get all jobs
   * @returns {Array} - Array of job data objects
   */
  getJobs() {
    return Array.from(this.state.jobs.values());
  }

  /**
   * Set job polling stop function
   * @param {string} jobId - Job ID
   * @param {Function} stopFn - Stop polling function
   */
  setJobPolling(jobId, stopFn) {
    const job = this.state.jobs.get(jobId);
    if (job) {
      job.pollStop = stopFn;
    }
  }

  /**
   * Get job polling stop function
   * @param {string} jobId - Job ID
   * @returns {Function|null} - Stop function or null
   */
  getJobPolling(jobId) {
    const job = this.state.jobs.get(jobId);
    return job?.pollStop || null;
  }

  /**
   * Add a cohort to tracking
   * @param {string} cohortId - Cohort ID
   * @param {Object} data - Cohort data
   */
  addCohort(cohortId, data) {
    this.state.cohorts.set(cohortId, {
      ...data,
      jobIds: data.jobIds || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    this.addToHistory({
      type: 'cohort.added',
      cohortId,
      data,
    });

    this.emit('cohort.added', cohortId, data);
    this.emit('cohorts.changed');
  }

  /**
   * Get a specific cohort
   * @param {string} cohortId - Cohort ID
   * @returns {Object|null} - Cohort data or null
   */
  getCohort(cohortId) {
    return this.state.cohorts.get(cohortId) || null;
  }

  /**
   * Get all cohorts
   * @returns {Array} - Array of cohort data objects
   */
  getCohorts() {
    return Array.from(this.state.cohorts.values());
  }

  /**
   * Add a job to a cohort
   * @param {string} cohortId - Cohort ID
   * @param {string} jobId - Job ID
   */
  addJobToCohort(cohortId, jobId) {
    const cohort = this.state.cohorts.get(cohortId);
    if (cohort && !cohort.jobIds.includes(jobId)) {
      cohort.jobIds.push(jobId);
      cohort.updatedAt = Date.now();

      // Also track cohort in job
      const job = this.state.jobs.get(jobId);
      if (job) {
        job.cohortId = cohortId;
      }

      this.emit('cohort.job.added', cohortId, jobId);
      this.emit('cohorts.changed');
    }
  }

  /**
   * Get cohort job count
   * @param {string} cohortId - Cohort ID
   * @returns {number} - Number of jobs in cohort
   */
  getCohortJobCount(cohortId) {
    const cohort = this.state.cohorts.get(cohortId);
    return cohort?.jobIds?.length || 0;
  }

  /**
   * Get cohort ID for a job
   * @param {string} jobId - Job ID
   * @returns {string|null} - Cohort ID or null
   */
  getJobCohort(jobId) {
    const job = this.state.jobs.get(jobId);
    return job?.cohortId || null;
  }

  /**
   * Check if all cohort jobs are complete
   * @param {string} cohortId - Cohort ID
   * @returns {boolean} - True if all jobs complete
   */
  areCohortJobsComplete(cohortId) {
    const cohort = this.state.cohorts.get(cohortId);
    if (!cohort || !cohort.jobIds || cohort.jobIds.length === 0) {
      return false;
    }

    return cohort.jobIds.every(jobId => {
      const job = this.state.jobs.get(jobId);
      return job?.status === 'completed';
    });
  }

  /**
   * Set cohort polling stop function
   * @param {string} cohortId - Cohort ID
   * @param {Function} stopFn - Stop polling function
   */
  setCohortPolling(cohortId, stopFn) {
    const cohort = this.state.cohorts.get(cohortId);
    if (cohort) {
      cohort.pollStop = stopFn;
    }
  }

  /**
   * Start countdown timer (ensures only one instance)
   * @param {string} jobId - Optional job ID this countdown is for
   */
  startCountdown(jobId = null) {
    // Clear any existing countdown first
    this.clearCountdown();

    this.state.countdown.isActive = true;
    this.state.countdown.timeLeft = 20;
    this.state.countdown.jobId = jobId;

    this.state.countdown.interval = setInterval(() => {
      this.state.countdown.timeLeft--;

      // Emit tick event
      this.emit('countdown.tick', this.state.countdown.timeLeft);

      // Reset at zero (creates infinite countdown)
      if (this.state.countdown.timeLeft <= 0) {
        this.state.countdown.timeLeft = 20;
      }
    }, 1000);

    this.addToHistory({
      type: 'countdown.started',
      jobId,
    });

    this.emit('countdown.started', jobId);
  }

  /**
   * Reset countdown to initial value without restarting
   */
  resetCountdown() {
    this.state.countdown.timeLeft = 20;
    this.emit('countdown.reset');
  }

  /**
   * Clear countdown timer completely
   */
  clearCountdown() {
    if (this.state.countdown.interval) {
      clearInterval(this.state.countdown.interval);
      this.state.countdown.interval = null;
      this.state.countdown.isActive = false;
      this.state.countdown.jobId = null;

      this.addToHistory({
        type: 'countdown.stopped',
      });

      this.emit('countdown.stopped');
    }
  }

  /**
   * Show spinner (supports nesting)
   */
  showSpinner() {
    this.state.spinner.count++;
    if (!this.state.spinner.isActive) {
      this.state.spinner.isActive = true;
      this.emit('spinner.shown');
    }
  }

  /**
   * Hide spinner (supports nesting)
   */
  hideSpinner() {
    this.state.spinner.count = Math.max(0, this.state.spinner.count - 1);
    if (this.state.spinner.count === 0 && this.state.spinner.isActive) {
      this.state.spinner.isActive = false;
      this.emit('spinner.hidden');
    }
  }

  /**
   * Force hide spinner (reset count)
   */
  forceHideSpinner() {
    this.state.spinner.count = 0;
    if (this.state.spinner.isActive) {
      this.state.spinner.isActive = false;
      this.emit('spinner.hidden');
    }
  }

  /**
   * Cleanup all resources and intervals
   */
  cleanup() {
    // Clear countdown
    this.clearCountdown();

    // Clear server monitoring
    if (this.state.serverLoad.interval) {
      clearInterval(this.state.serverLoad.interval);
      this.state.serverLoad.interval = null;
    }

    // Stop all job polls
    for (const [_jobId, job] of this.state.jobs.entries()) {
      if (job.pollStop && typeof job.pollStop === 'function') {
        job.pollStop();
      }
    }

    this.addToHistory({
      type: 'cleanup',
    });

    this.emit('cleanup');
    logMessage('StateManager cleanup complete', 'info');
  }

  /**
   * Register event listener
   * @param {string} event - Event name (e.g., 'countdown.tick', 'job.added')
   * @param {Function} callback - Callback function
   * @returns {Function} - Unsubscribe function
   *
   * @example
   * const unsubscribe = stateManager.on('countdown.tick', (timeLeft) => {
   *   console.log('Time left:', timeLeft);
   * });
   * // Later:
   * unsubscribe();
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  /**
   * Register one-time event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  once(event, callback) {
    const unsubscribe = this.on(event, (...args) => {
      callback(...args);
      unsubscribe();
    });
  }

  /**
   * Emit event to all listeners
   * @param {string} event - Event name
   * @param {...*} args - Arguments to pass to listeners
   */
  emit(event, ...args) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(...args);
        } catch (error) {
          logMessage(`[StateManager] Error in listener for '${event}': ${error.message}`, 'error');
        }
      }
    }
  }

  /**
   * Remove all listeners for an event
   * @param {string} event - Event name
   */
  off(event) {
    this.listeners.delete(event);
  }

  /**
   * Add entry to state change history
   * @param {Object} entry - History entry
   */
  addToHistory(entry) {
    this.history.push({
      ...entry,
      timestamp: Date.now(),
      iso: new Date().toISOString(),
    });

    // Keep history size limited
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Get state change history
   * @param {number} limit - Max number of entries (default: all)
   * @returns {Array} - History entries
   */
  getHistory(limit = null) {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Get debug information
   * @returns {Object} - Debug info
   */
  getDebugInfo() {
    return {
      jobCount: this.state.jobs.size,
      cohortCount: this.state.cohorts.size,
      countdownActive: this.state.countdown.isActive,
      spinnerActive: this.state.spinner.isActive,
      listenerCounts: Array.from(this.listeners.entries()).map(([event, listeners]) => ({
        event,
        count: listeners.size,
      })),
      historySize: this.history.length,
      recentHistory: this.getHistory(10),
    };
  }
}

// Create singleton instance
export const stateManager = new StateManager();

// Cleanup on page unload (guard for test environments)
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('beforeunload', () => {
    stateManager.cleanup();
  });

  // Log state changes in development
  if (window.location && window.location.port === '3000') {
    stateManager.on('state.changed', ({ path, value, oldValue }) => {
      logMessage(
        `[State] ${path}: ${JSON.stringify(oldValue)} -> ${JSON.stringify(value)}`,
        'debug'
      );
    });
  }
}
