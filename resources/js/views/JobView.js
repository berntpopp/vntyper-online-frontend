// frontend/resources/js/views/JobView.js

import { createLabelValue, safeGetElementById } from '../domHelpers.js';
import { displayShareableLink, hidePlaceholderMessage } from '../uiUtils.js';

/**
 * Job View - Handles job UI rendering
 *
 * Purpose: Renders job status, progress, and results in the UI.
 * Separates presentation logic from business logic.
 *
 * Benefits:
 * - Single Responsibility: Only handles job UI rendering
 * - Reusability: Can render any job object
 * - Testability: Easy to test UI generation
 * - Maintainability: UI changes in one place
 *
 * SOLID Principles:
 * - Single Responsibility: Only renders job UI
 * - Open/Closed: Easy to extend with new job types
 * - Dependency Inversion: Uses DOM helpers abstraction
 *
 * @class JobView
 */
export class JobView {
  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {HTMLElement} [dependencies.container] - Container for job outputs
   */
  constructor(dependencies = {}) {
    this.container = dependencies.container || safeGetElementById('jobOutput');
    this.jobElements = new Map(); // jobId -> HTMLElement
  }

  /**
   * Show a new job in the UI
   * @param {Job} job - Job model
   */
  showJob(job) {
    // Hide placeholder message when showing job
    hidePlaceholderMessage();

    const jobElement = this._createJobElement(job);
    this.jobElements.set(job.jobId, jobElement);

    if (this.container) {
      this.container.appendChild(jobElement);
    }

    // Show shareable link after job is created
    this.showShareableLink(job.jobId);

    return jobElement;
  }

  /**
   * Show shareable link for job
   * @param {string} jobId - Job ID
   */
  showShareableLink(jobId) {
    const jobElement = this.jobElements.get(jobId);
    if (!jobElement) {
      return;
    }

    // Display shareable link using uiUtils function
    displayShareableLink(jobId, jobElement, 'job');
  }

  /**
   * Update job status display
   * @param {string} jobId - Job ID
   * @param {string} status - New status
   */
  updateStatus(jobId, status) {
    const jobElement = this.jobElements.get(jobId);
    if (!jobElement) {
      return;
    }

    const statusElement = jobElement.querySelector('.job-status');
    if (statusElement) {
      statusElement.textContent = this._formatStatus(status);
      statusElement.className = `job-status status-${status}`;
    }
  }

  /**
   * Show download link for completed job
   * @param {string} jobId - Job ID
   */
  showDownloadLink(jobId) {
    const jobElement = this.jobElements.get(jobId);
    if (!jobElement) {
      return;
    }

    const downloadContainer = jobElement.querySelector('.job-download');
    if (!downloadContainer) {
      return;
    }

    // Unhide the container
    downloadContainer.classList.remove('hidden');

    // Create download link manually
    const downloadUrl = `${window.CONFIG.API_URL}/download/${jobId}/`;

    const downloadLink = document.createElement('a');
    downloadLink.id = `download-${jobId}`;
    downloadLink.href = downloadUrl;
    downloadLink.className = 'download-link';
    downloadLink.textContent = 'Download Results';
    downloadLink.download = `results_${jobId}.zip`;

    downloadContainer.appendChild(downloadLink);
  }

  /**
   * Show error for failed job
   * @param {string} jobId - Job ID
   * @param {string} errorMessage - Error message
   */
  showError(jobId, errorMessage) {
    const jobElement = this.jobElements.get(jobId);
    if (!jobElement) {
      return;
    }

    const errorContainer = jobElement.querySelector('.job-error');
    if (errorContainer) {
      errorContainer.textContent = errorMessage;
      errorContainer.classList.remove('hidden');
    }
  }

  /**
   * Update job progress
   * @param {string} jobId - Job ID
   * @param {number} progress - Progress percentage (0-100)
   */
  updateProgress(jobId, progress) {
    const jobElement = this.jobElements.get(jobId);
    if (!jobElement) {
      return;
    }

    const progressBar = jobElement.querySelector('.job-progress-bar');
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
      progressBar.setAttribute('aria-valuenow', progress);
    }

    const progressText = jobElement.querySelector('.job-progress-text');
    if (progressText) {
      progressText.textContent = `${progress}%`;
    }
  }

  /**
   * Remove job from UI
   * @param {string} jobId - Job ID
   */
  removeJob(jobId) {
    const jobElement = this.jobElements.get(jobId);
    if (jobElement && jobElement.parentNode) {
      jobElement.parentNode.removeChild(jobElement);
    }
    this.jobElements.delete(jobId);
  }

  /**
   * Clear all jobs from UI
   */
  clearAll() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.jobElements.clear();
  }

  /**
   * Create job UI element
   * @private
   */
  _createJobElement(job) {
    const jobDiv = document.createElement('div');
    jobDiv.className = 'job-item';
    jobDiv.id = `job-${job.jobId}`;

    // Job header with ID
    const header = createLabelValue('Job ID: ', job.jobId, {
      containerClass: 'job-header',
      valueClass: 'job-id',
    });
    jobDiv.appendChild(header);

    // File name (if available)
    if (job.fileName) {
      const fileName = createLabelValue('File: ', job.fileName, {
        containerClass: 'job-file',
        valueClass: 'file-name',
      });
      jobDiv.appendChild(fileName);
    }

    // Status
    const statusDiv = document.createElement('div');
    statusDiv.className = 'job-status-container';

    const statusLabel = document.createTextNode('Status: ');
    statusDiv.appendChild(statusLabel);

    const statusElement = document.createElement('span');
    statusElement.className = `job-status status-${job.status}`;
    statusElement.textContent = this._formatStatus(job.status);
    statusDiv.appendChild(statusElement);

    jobDiv.appendChild(statusDiv);

    // Progress bar (for active jobs)
    if (job.isActive()) {
      const progressContainer = this._createProgressBar();
      jobDiv.appendChild(progressContainer);
    }

    // Download link container (hidden until complete)
    const downloadContainer = document.createElement('div');
    downloadContainer.className = 'job-download hidden';
    jobDiv.appendChild(downloadContainer);

    // Error container (hidden until error)
    const errorContainer = document.createElement('div');
    errorContainer.className = 'job-error hidden error-message';
    jobDiv.appendChild(errorContainer);

    return jobDiv;
  }

  /**
   * Create progress bar element
   * @private
   */
  _createProgressBar() {
    const container = document.createElement('div');
    container.className = 'job-progress-container';

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.setAttribute('role', 'progressbar');
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', '100');
    progressBar.setAttribute('aria-valuenow', '0');

    const fill = document.createElement('div');
    fill.className = 'job-progress-bar';
    fill.style.width = '0%';

    progressBar.appendChild(fill);
    container.appendChild(progressBar);

    const progressText = document.createElement('span');
    progressText.className = 'job-progress-text';
    progressText.textContent = '0%';
    container.appendChild(progressText);

    return container;
  }

  /**
   * Format status for display
   * @private
   */
  _formatStatus(status) {
    const statusMap = {
      pending: 'Pending',
      queued: 'Queued',
      started: 'Started',
      processing: 'Processing',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
    };

    return statusMap[status] || status;
  }

  /**
   * Get job element
   * @param {string} jobId - Job ID
   * @returns {HTMLElement|null} Job element
   */
  getJobElement(jobId) {
    return this.jobElements.get(jobId) || null;
  }

  /**
   * Check if job is displayed
   * @param {string} jobId - Job ID
   * @returns {boolean} True if job is displayed
   */
  hasJob(jobId) {
    return this.jobElements.has(jobId);
  }
}
