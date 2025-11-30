// frontend/resources/js/services/APIService.js

import {
  submitJobToAPI,
  getJobStatus,
  getCohortStatus,
  createCohort,
  pollJobStatusAPI,
  pollCohortStatusAPI,
} from '../apiInteractions.js';
import { Job } from '../models/Job.js';
import { Cohort } from '../models/Cohort.js';
import { logMessage } from '../log.js';

/**
 * API Service - Wraps API interactions with clean interface
 *
 * Purpose: Provides a clean, object-oriented interface to the backend API,
 * handling request/response transformation and error handling.
 *
 * Benefits:
 * - Abstraction: Hides API implementation details
 * - Consistency: Uniform error handling and response transformation
 * - Testability: Easy to mock for testing
 * - Type Safety: Returns domain models instead of raw JSON
 *
 * SOLID Principles:
 * - Single Responsibility: Handles only API communication
 * - Open/Closed: Easy to extend with new endpoints
 * - Dependency Inversion: Controllers depend on this abstraction, not raw fetch
 * - Interface Segregation: Clean, focused API methods
 *
 * @class APIService
 */
export class APIService {
  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {Object} dependencies.config - Configuration object
   * @param {Object} [dependencies.logger] - Logger instance
   */
  constructor(dependencies = {}) {
    this.config = dependencies.config || window.CONFIG;
    this.logger = dependencies.logger || console;
    this.baseURL = this.config.API_URL;
  }

  /**
   * Submit a job to the API
   * @param {FormData} formData - Form data with job parameters
   * @param {string} [cohortId] - Optional cohort ID
   * @param {string} [passphrase] - Optional passphrase
   * @returns {Promise<Job>} Created job
   */
  async submitJob(formData, cohortId = null, passphrase = null) {
    try {
      const response = await submitJobToAPI(formData, cohortId, passphrase);
      return Job.fromAPI(response);
    } catch (error) {
      this._handleError('submitJob', error);
      throw error;
    }
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status data
   */
  async getJobStatus(jobId) {
    try {
      return await getJobStatus(jobId);
    } catch (error) {
      this._handleError('getJobStatus', error);
      throw error;
    }
  }

  /**
   * Poll job status until completion
   * @param {string} jobId - Job ID
   * @param {Function} onUpdate - Status update callback
   * @param {Function} onComplete - Completion callback
   * @param {Function} onError - Error callback
   * @returns {Function} Stop polling function
   */
  pollJobStatus(jobId, onUpdate, onComplete, onError) {
    try {
      return pollJobStatusAPI(jobId, onUpdate, onComplete, onError);
    } catch (error) {
      this._handleError('pollJobStatus', error);
      throw error;
    }
  }

  /**
   * Create a cohort
   * @param {string} alias - Cohort alias
   * @param {string} [passphrase] - Optional passphrase
   * @returns {Promise<Cohort>} Created cohort
   */
  async createCohort(alias, passphrase = null) {
    try {
      const response = await createCohort(alias, passphrase);
      return Cohort.fromAPI(response);
    } catch (error) {
      this._handleError('createCohort', error);
      throw error;
    }
  }

  /**
   * Get cohort status
   * @param {string} cohortId - Cohort ID
   * @param {string} [passphrase] - Optional passphrase
   * @param {string} [alias] - Optional alias
   * @returns {Promise<Object>} Cohort status data
   */
  async getCohortStatus(cohortId, passphrase = null, alias = null) {
    try {
      return await getCohortStatus(cohortId, passphrase, alias);
    } catch (error) {
      this._handleError('getCohortStatus', error);
      throw error;
    }
  }

  /**
   * Poll cohort status until all jobs complete
   * @param {string} cohortId - Cohort ID
   * @param {string} [passphrase] - Optional passphrase
   * @param {Function} onUpdate - Status update callback
   * @param {Function} onComplete - Completion callback
   * @param {Function} onError - Error callback
   * @returns {Function} Stop polling function
   */
  pollCohortStatus(cohortId, passphrase, onUpdate, onComplete, onError) {
    try {
      return pollCohortStatusAPI(cohortId, passphrase, onUpdate, onComplete, onError);
    } catch (error) {
      this._handleError('pollCohortStatus', error);
      throw error;
    }
  }

  /**
   * Handle API errors consistently
   * @private
   */
  _handleError(method, error) {
    const message = `[APIService.${method}] ${error.message}`;
    // Use injected logger if it has logMessage method, otherwise use global logMessage
    if (this.logger && typeof this.logger.logMessage === 'function') {
      this.logger.logMessage(message, 'error');
    } else {
      logMessage(message, 'error');
    }
  }
}
