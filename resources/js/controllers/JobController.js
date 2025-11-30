// frontend/resources/js/controllers/JobController.js

import { BaseController } from './BaseController.js';
import { Job } from '../models/Job.js';
import { showSpinner, hideSpinner, startCountdown, clearCountdown } from '../uiUtils.js';

/**
 * Job Controller - Handles job submission and tracking
 *
 * Purpose: Manages job lifecycle from submission through completion,
 * coordinating between API, state, and UI.
 *
 * Responsibilities:
 * - Job submission and validation
 * - Status polling coordination
 * - UI updates for job progress
 * - Download link generation
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles job operations
 * - Open/Closed: Easy to extend with new job types
 * - Dependency Inversion: Depends on abstractions (EventBus, APIService, etc.)
 * - Liskov Substitution: Can be replaced with specialized job controllers
 *
 * @class JobController
 * @extends BaseController
 */
export class JobController extends BaseController {
  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {EventBus} dependencies.eventBus - Event bus
   * @param {StateManager} dependencies.stateManager - State manager
   * @param {APIService} dependencies.apiService - API service
   * @param {JobView} dependencies.jobView - Job view
   * @param {ErrorView} dependencies.errorView - Error view
   */
  constructor(dependencies) {
    super(dependencies);

    this.apiService = dependencies.apiService;
    this.jobView = dependencies.jobView;
    this.errorView = dependencies.errorView;
    this.pollingManager = dependencies.pollingManager;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    this.on('job:submit', this.handleSubmit);
    this.on('job:cancel', this.handleCancel);
    this.on('job:retry', this.handleRetry);
    this.on('job:poll', this.handlePoll);
    this.on('job:download', this.handleDownload);
  }

  /**
   * Handle job submission
   * @param {Object} params - Submission parameters
   * @param {FormData} params.formData - Form data with job files and options
   * @param {string} [params.cohortId] - Optional cohort ID
   * @param {string} [params.passphrase] - Optional passphrase
   * @param {string} [params.fileName] - File name for display
   */
  async handleSubmit({ formData, cohortId, passphrase, fileName }) {
    try {
      this._log('Submitting job', 'info', { cohortId, fileName });

      // Show UI feedback
      showSpinner();
      startCountdown();

      // Submit job via API
      const job = await this.apiService.submitJob(formData, cohortId, passphrase);

      // Update state
      this.stateManager.addJob(job.jobId, {
        status: job.status,
        fileName: fileName || job.fileName,
        cohortId,
        createdAt: Date.now(),
      });

      // Show job in UI
      this.jobView.showJob(job);

      // Emit success event
      this.emit('job:submitted', {
        jobId: job.jobId,
        cohortId,
        job,
      });

      // Start polling
      this.emit('job:poll', { jobId: job.jobId });

      this._log(`Job submitted: ${job.jobId}`, 'success');

      return job;
    } catch (error) {
      this.handleError(error, 'Job submission failed');
      this.errorView.show(error, 'Job Submission');

      // Clean up UI
      hideSpinner();
      clearCountdown();

      throw error;
    }
  }

  /**
   * Handle job polling
   * @param {Object} params - Polling parameters
   * @param {string} params.jobId - Job ID to poll
   */
  async handlePoll({ jobId }) {
    try {
      this._log(`Starting polling for job: ${jobId}`, 'info');

      // Use polling manager to start polling
      const stopPolling = this.pollingManager.start(
        jobId,
        async () => {
          return await this.apiService.getJobStatus(jobId);
        },
        {
          interval: 5000,
          maxRetries: 10,
          onUpdate: statusData => {
            this.handleStatusUpdate(jobId, statusData);
          },
          onComplete: statusData => {
            this.handleJobComplete(jobId, statusData);
          },
          onError: error => {
            this.handleJobError(jobId, error);
          },
        }
      );

      // Store stop function in state
      this.stateManager.setJobPolling(jobId, stopPolling);
    } catch (error) {
      this.handleError(error, `Polling failed for job ${jobId}`);
    }
  }

  /**
   * Handle job status update
   * @param {string} jobId - Job ID
   * @param {Object} statusData - Status data from API
   */
  handleStatusUpdate(jobId, statusData) {
    const status = statusData.status;

    this._log(`Job ${jobId} status: ${status}`, 'info');

    // Update state
    this.stateManager.updateJobStatus(jobId, status);

    // Update view
    this.jobView.updateStatus(jobId, status);

    // Emit status update event
    this.emit('job:status:updated', { jobId, status, statusData });
  }

  /**
   * Handle job completion
   * @param {string} jobId - Job ID
   * @param {Object} statusData - Final status data
   */
  handleJobComplete(jobId, statusData) {
    this._log(`Job ${jobId} completed`, 'success');

    // Update state
    this.stateManager.updateJobStatus(jobId, 'completed');

    // Show download link
    this.jobView.showDownloadLink(jobId);

    // Clean up UI
    hideSpinner();
    clearCountdown();

    // Emit completion event
    this.emit('job:completed', { jobId, statusData });
  }

  /**
   * Handle job error
   * @param {string} jobId - Job ID
   * @param {Error} error - Error object
   */
  handleJobError(jobId, error) {
    this._log(`Job ${jobId} failed: ${error.message}`, 'error');

    // Update state
    this.stateManager.updateJobStatus(jobId, 'failed');

    // Show error in view
    this.jobView.showError(jobId, error.message);

    // Clean up UI
    hideSpinner();
    clearCountdown();

    // Emit error event
    this.emit('job:failed', { jobId, error });
  }

  /**
   * Handle job cancellation
   * @param {Object} params - Cancellation parameters
   * @param {string} params.jobId - Job ID to cancel
   */
  handleCancel({ jobId }) {
    this._log(`Cancelling job: ${jobId}`, 'info');

    // Stop polling
    const stopPolling = this.stateManager.getJobPolling(jobId);
    if (stopPolling) {
      stopPolling();
    }

    // Update state
    this.stateManager.updateJobStatus(jobId, 'cancelled');

    // Update view
    this.jobView.updateStatus(jobId, 'cancelled');

    // Emit cancellation event
    this.emit('job:cancelled', { jobId });
  }

  /**
   * Handle job retry
   * @param {Object} params - Retry parameters
   * @param {string} params.jobId - Job ID to retry
   */
  async handleRetry({ jobId }) {
    try {
      this._log(`Retrying job: ${jobId}`, 'info');

      // Get job from state
      const jobData = this.stateManager.getJob(jobId);
      if (!jobData) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Re-submit with same parameters
      await this.handleSubmit({
        formData: jobData.formData,
        cohortId: jobData.cohortId,
        passphrase: jobData.passphrase,
        fileName: jobData.fileName,
      });

      this.emit('job:retried', { jobId });
    } catch (error) {
      this.handleError(error, `Retry failed for job ${jobId}`);
      this.errorView.show(error, 'Job Retry');
    }
  }

  /**
   * Handle job download
   * @param {Object} params - Download parameters
   * @param {string} params.jobId - Job ID to download
   */
  handleDownload({ jobId }) {
    this._log(`Downloading job results: ${jobId}`, 'info');

    // Emit download event
    this.emit('job:download:started', { jobId });

    // Open download URL
    const downloadUrl = `${window.CONFIG.API_URL}/download/${jobId}/`;
    window.open(downloadUrl, '_blank');

    this.emit('job:download:complete', { jobId });
  }

  /**
   * Get job by ID
   * @param {string} jobId - Job ID
   * @returns {Job|null} Job model or null
   */
  getJob(jobId) {
    const jobData = this.stateManager.getJob(jobId);
    return jobData ? new Job(jobData) : null;
  }

  /**
   * Get all jobs
   * @returns {Job[]} Array of job models
   */
  getAllJobs() {
    const jobs = this.stateManager.getJobs();
    return jobs.map(jobData => new Job(jobData));
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Stop all active polling
    const jobs = this.getAllJobs();
    for (const job of jobs) {
      if (job.pollStop) {
        job.pollStop();
      }
    }

    this._log('Cleanup complete', 'info');
  }
}
