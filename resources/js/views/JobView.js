// frontend/resources/js/views/JobView.js

import { createLabelValue, createTextElement, safeGetElementById } from '../domHelpers.js';
import { displayShareableLink, hidePlaceholderMessage } from '../uiUtils.js';
import { t } from '../i18n.js';

// Functions, not constants: translate only after the locale's strings have loaded.
const COVERAGE_QC_LABELS = () => ({
  PASS: t('Pass'),
  REDUCED: t('Reduced (a weak variant signal can be missed)'),
  FAIL: t('Fail'),
  NOT_EVALUATED: t('Not evaluated'),
});

// Grade tokens and wording from VNtyper report_config.json chip_labels.
const CONFIDENCE_LABELS = () => ({
  finding: t('Finding'),
  'finding-corroborated': t('Finding, corroborated'),
  'finding-limited': t('Finding, with caveats'),
  'no-finding': t('No finding'),
  'no-finding-limited': t('No finding, inconclusive'),
  'not-established': t('No result'),
});

const note = text => createTextElement('p', text, { className: 'job-summary-note' });
// Number(null) is 0, so a missing value must not pass as a finite number.
const finite = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);

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
   * @param {import('../models/Job.js').Job} job - Job model
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
    downloadLink.textContent = t('Download Results');
    downloadLink.download = `results_${jobId}.zip`;

    downloadContainer.appendChild(downloadLink);
  }

  /**
   * Show coverage QC, confidence grade, subthreshold signal and the long-array
   * note from a job's pipeline_summary.json. Fields an older backend does not
   * write are skipped; a null summary (no /job-summary/ route) renders nothing.
   * @param {string} jobId - Job ID
   * @param {Object|null} summary - pipeline_summary.json, or null
   */
  showSummary(jobId, summary) {
    const jobElement = this.jobElements.get(jobId);
    if (!jobElement || !summary || typeof summary !== 'object') {
      return;
    }

    const coverageQc = (Array.isArray(summary.steps) ? summary.steps : []).find(
      step => step?.step === 'Coverage Calculation'
    )?.parsed_result?.data?.[0]?.coverage_qc;
    const grade = summary.confidence_grade;
    const subthreshold = summary.subthreshold_signal;
    const highThreshold = summary.length_sensitivity_policy?.high_threshold;

    const rows = [];
    if (coverageQc) {
      const label = COVERAGE_QC_LABELS()[coverageQc] || coverageQc;
      rows.push(createLabelValue(t('Coverage QC: '), label));
    }
    if (grade) {
      rows.push(createLabelValue(t('Confidence: '), CONFIDENCE_LABELS()[grade] || grade));
    }
    if (subthreshold?.state === 'negative_subthreshold') {
      const score = finite(subthreshold.best_depth_score);
      rows.push(
        note(
          score !== null
            ? t(
                'A candidate variant was seen below the reporting threshold (best depth score {score}). It is not a call.',
                { score: String(Number(score.toPrecision(3))) }
              )
            : t('A candidate variant was seen below the reporting threshold. It is not a call.')
        )
      );
    }
    if (summary.length_sensitivity_tier === 'high') {
      rows.push(
        note(
          finite(highThreshold) !== null
            ? t(
                'The VNTR array is estimated at over {threshold} repeats. Detection is less sensitive in long arrays, mostly for frameshifts other than dupC.',
                { threshold: String(highThreshold) }
              )
            : t(
                'The VNTR array is estimated to be long. Detection is less sensitive in long arrays, mostly for frameshifts other than dupC.'
              )
        )
      );
    }
    if (rows.length === 0) {
      return;
    }

    jobElement.querySelector('.job-summary')?.remove();
    const panel = document.createElement('div');
    panel.className = 'job-summary';
    panel.append(
      ...rows,
      note(
        t(
          'Research use only. A negative result does not exclude ADTKD-MUC1. Only unflagged calls are positive: flagged calls carry transparency flags for review, and 4-bp insertion artifacts are filtered out and never count as positive.'
        )
      )
    );
    jobElement.querySelector('.job-download')?.after(panel);
  }

  /**
   * Remove a previously rendered download link.
   *
   * A job can reach a terminal failure after a link was already shown (the
   * status update arrives before the terminal callback). Without this, the
   * user is offered a download for a run that produced no result.
   *
   * @param {string} jobId - Job ID
   */
  hideDownloadLink(jobId) {
    const jobElement = this.jobElements.get(jobId);
    if (!jobElement) {
      return;
    }

    const downloadContainer = jobElement.querySelector('.job-download');
    if (!downloadContainer) {
      return;
    }

    const existingLink = downloadContainer.querySelector(`#download-${jobId}`);
    if (existingLink) {
      existingLink.remove();
    }

    downloadContainer.classList.add('hidden');
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
    const header = createLabelValue(t('Job ID: '), job.jobId, {
      containerClass: 'job-header',
      valueClass: 'job-id',
    });
    jobDiv.appendChild(header);

    // File name (if available)
    if (job.fileName) {
      const fileName = createLabelValue(t('File: '), job.fileName, {
        containerClass: 'job-file',
        valueClass: 'file-name',
      });
      jobDiv.appendChild(fileName);
    }

    // Status
    const statusDiv = document.createElement('div');
    statusDiv.className = 'job-status-container';

    const statusLabel = document.createTextNode(t('Status: '));
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
      pending: t('Pending'),
      queued: t('Queued'),
      started: t('Started'),
      processing: t('Processing'),
      completed: t('Completed'),
      failed: t('Failed'),
      cancelled: t('Cancelled'),
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
