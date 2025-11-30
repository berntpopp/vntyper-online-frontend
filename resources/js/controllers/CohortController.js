// frontend/resources/js/controllers/CohortController.js

import { BaseController } from './BaseController.js';
import { Cohort } from '../models/Cohort.js';

/**
 * Cohort Controller - Handles cohort creation and management
 *
 * Purpose: Manages cohort lifecycle, job grouping, and cohort analysis.
 *
 * Responsibilities:
 * - Cohort creation
 * - Job association with cohorts
 * - Cohort status polling
 * - Cohort analysis triggering
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles cohort operations
 * - Open/Closed: Easy to extend with new cohort features
 * - Dependency Inversion: Depends on abstractions
 *
 * @class CohortController
 * @extends BaseController
 */
export class CohortController extends BaseController {
  /**
   * @param {Object} dependencies - Injected dependencies
   */
  constructor(dependencies) {
    super(dependencies);

    this.apiService = dependencies.apiService;
    this.cohortView = dependencies.cohortView;
    this.errorView = dependencies.errorView;
    this.pollingManager = dependencies.pollingManager;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    this.on('cohort:create', this.handleCreate);
    this.on('cohort:addJob', this.handleAddJob);
    this.on('cohort:poll', this.handlePoll);
    this.on('cohort:analyze', this.handleAnalyze);
    this.on('job:submitted', this.handleJobSubmitted);
    this.on('job:completed', this.handleJobCompleted);
  }

  /**
   * Handle cohort creation
   * @param {Object} params - Creation parameters
   * @param {string} [params.alias] - Cohort alias
   * @param {string} [params.passphrase] - Optional passphrase
   */
  async handleCreate({ alias, passphrase }) {
    try {
      this._log('Creating cohort', 'info', { alias });

      // Generate default alias if not provided
      const cohortAlias = alias || this.generateDefaultAlias();

      // Create cohort via API
      const cohort = await this.apiService.createCohort(cohortAlias, passphrase);

      // Update state
      this.stateManager.addCohort(cohort.cohortId, {
        alias: cohort.alias,
        hasPassphrase: cohort.hasPassphrase,
        jobIds: [],
        createdAt: Date.now(),
      });

      // Show cohort in UI
      this.cohortView.showCohort(cohort, {
        showShareableLink: true,
      });

      // Emit success event
      this.emit('cohort:created', {
        cohortId: cohort.cohortId,
        cohort,
      });

      this._log(`Cohort created: ${cohort.cohortId}`, 'success');

      return cohort;
    } catch (error) {
      this.handleError(error, 'Cohort creation failed');
      this.errorView.show(error, 'Cohort Creation');
      throw error;
    }
  }

  /**
   * Handle job submitted event
   * @param {Object} params - Event parameters
   * @param {string} params.jobId - Job ID
   * @param {string} params.cohortId - Cohort ID
   */
  handleJobSubmitted({ jobId, cohortId }) {
    if (!cohortId) {
      return; // Not a cohort job
    }

    this._log(`Adding job ${jobId} to cohort ${cohortId}`, 'info');

    // Add job to cohort
    this.emit('cohort:addJob', { cohortId, jobId });
  }

  /**
   * Handle adding job to cohort
   * @param {Object} params - Parameters
   * @param {string} params.cohortId - Cohort ID
   * @param {string} params.jobId - Job ID
   */
  handleAddJob({ cohortId, jobId }) {
    try {
      this._log(`Adding job ${jobId} to cohort ${cohortId}`, 'info');

      // Update state
      this.stateManager.addJobToCohort(cohortId, jobId);

      // Update view
      this.cohortView.updateCohort(cohortId, {
        jobCount: this.stateManager.getCohortJobCount(cohortId),
      });

      // Emit event
      this.emit('cohort:job:added', { cohortId, jobId });
    } catch (error) {
      this.handleError(error, `Failed to add job to cohort`);
    }
  }

  /**
   * Handle job completed event
   * @param {Object} params - Event parameters
   * @param {string} params.jobId - Job ID
   */
  handleJobCompleted({ jobId }) {
    // Check if job belongs to a cohort
    const cohortId = this.stateManager.getJobCohort(jobId);
    if (!cohortId) {
      return;
    }

    // Check if all cohort jobs are complete
    const allComplete = this.stateManager.areCohortJobsComplete(cohortId);
    if (allComplete) {
      this._log(`All jobs in cohort ${cohortId} completed`, 'info');
      this.emit('cohort:allJobsComplete', { cohortId });

      // Show analysis section
      this.cohortView.showAnalysisSection(cohortId);
    }
  }

  /**
   * Handle cohort polling
   * @param {Object} params - Polling parameters
   * @param {string} params.cohortId - Cohort ID
   * @param {string} [params.passphrase] - Optional passphrase
   */
  async handlePoll({ cohortId, passphrase }) {
    try {
      this._log(`Starting polling for cohort: ${cohortId}`, 'info');

      // Use polling manager
      const stopPolling = this.pollingManager.start(
        `cohort-${cohortId}`,
        async () => {
          return await this.apiService.getCohortStatus(cohortId, passphrase);
        },
        {
          interval: 5000,
          maxRetries: 10,
          onUpdate: statusData => {
            this.handleStatusUpdate(cohortId, statusData);
          },
          onComplete: statusData => {
            this.handleCohortComplete(cohortId, statusData);
          },
          onError: error => {
            this.handleCohortError(cohortId, error);
          },
        }
      );

      // Store stop function in state
      this.stateManager.setCohortPolling(cohortId, stopPolling);
    } catch (error) {
      this.handleError(error, `Polling failed for cohort ${cohortId}`);
    }
  }

  /**
   * Handle cohort status update
   * @param {string} cohortId - Cohort ID
   * @param {Object} statusData - Status data
   */
  handleStatusUpdate(cohortId, statusData) {
    this._log(`Cohort ${cohortId} status update`, 'info');

    // Emit status update event
    this.emit('cohort:status:updated', { cohortId, statusData });
  }

  /**
   * Handle cohort completion
   * @param {string} cohortId - Cohort ID
   * @param {Object} statusData - Status data
   */
  handleCohortComplete(cohortId, statusData) {
    this._log(`Cohort ${cohortId} completed`, 'success');

    // Emit completion event
    this.emit('cohort:completed', { cohortId, statusData });
  }

  /**
   * Handle cohort error
   * @param {string} cohortId - Cohort ID
   * @param {Error} error - Error
   */
  handleCohortError(cohortId, error) {
    this._log(`Cohort ${cohortId} error: ${error.message}`, 'error');

    // Emit error event
    this.emit('cohort:failed', { cohortId, error });
  }

  /**
   * Handle cohort analysis
   * @param {Object} params - Analysis parameters
   * @param {string} params.cohortId - Cohort ID
   */
  async handleAnalyze({ cohortId }) {
    try {
      this._log(`Starting cohort analysis: ${cohortId}`, 'info');

      // Trigger cohort analysis via API
      // (API endpoint not shown in current codebase, but following the pattern)

      // Update view
      this.cohortView.updateAnalysisStatus(cohortId, 'processing');

      // Emit event
      this.emit('cohort:analysis:started', { cohortId });
    } catch (error) {
      this.handleError(error, `Cohort analysis failed`);
      this.errorView.show(error, 'Cohort Analysis');
    }
  }

  /**
   * Generate default cohort alias
   * @returns {string} Default alias
   */
  generateDefaultAlias() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `Cohort-${timestamp}`;
  }

  /**
   * Get cohort by ID
   * @param {string} cohortId - Cohort ID
   * @returns {Cohort|null} Cohort model or null
   */
  getCohort(cohortId) {
    const cohortData = this.stateManager.getCohort(cohortId);
    return cohortData ? new Cohort(cohortData) : null;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Stop all active cohort polling
    const cohorts = this.stateManager.getCohorts();
    for (const cohortData of cohorts) {
      if (cohortData.pollStop) {
        cohortData.pollStop();
      }
    }

    this._log('Cleanup complete', 'info');
  }
}
