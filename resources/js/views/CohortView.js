// frontend/resources/js/views/CohortView.js

import { createLabelValue, safeGetElementById } from '../domHelpers.js';
import { displayShareableLink, hidePlaceholderMessage } from '../uiUtils.js';

/**
 * Cohort View - Handles cohort UI rendering
 *
 * Purpose: Renders cohort information, job lists, and cohort analysis results.
 * Separates presentation logic from business logic.
 *
 * Benefits:
 * - Single Responsibility: Only handles cohort UI rendering
 * - Reusability: Can render any cohort object
 * - Testability: Easy to test UI generation
 * - Maintainability: UI changes in one place
 *
 * SOLID Principles:
 * - Single Responsibility: Only renders cohort UI
 * - Open/Closed: Easy to extend with new cohort features
 * - Dependency Inversion: Uses DOM helpers abstraction
 *
 * @class CohortView
 */
export class CohortView {
  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {HTMLElement} [dependencies.container] - Container for cohorts
   */
  constructor(dependencies = {}) {
    this.container = dependencies.container || safeGetElementById('cohortsContainer');
    this.cohortElements = new Map(); // cohortId -> HTMLElement
  }

  /**
   * Show a new cohort in the UI
   * @param {import('../models/Cohort.js').Cohort} cohort - Cohort model
   * @param {Object} [options={}] - Display options
   */
  showCohort(cohort, options = {}) {
    // Don't create duplicate cohort sections
    if (this.cohortElements.has(cohort.cohortId)) {
      return this.cohortElements.get(cohort.cohortId);
    }

    // Hide placeholder message when showing cohort
    hidePlaceholderMessage();

    const cohortElement = this._createCohortElement(cohort, options);
    this.cohortElements.set(cohort.cohortId, cohortElement);

    if (this.container) {
      this.container.appendChild(cohortElement);
    }

    if (options.showShareableLink) {
      this.showShareableLink(cohort.cohortId);
    }

    return cohortElement;
  }

  /**
   * Update cohort display
   * @param {string} cohortId - Cohort ID
   * @param {Object} data - Updated cohort data
   */
  updateCohort(cohortId, data) {
    const cohortElement = this.cohortElements.get(cohortId);
    if (!cohortElement) {
      return;
    }

    // Update job count
    if (data.jobCount !== undefined) {
      const jobCountElement = cohortElement.querySelector('.cohort-job-count');
      if (jobCountElement) {
        jobCountElement.textContent = data.jobCount;
      }
    }

    // Update status
    if (data.status) {
      const statusElement = cohortElement.querySelector('.cohort-status');
      if (statusElement) {
        statusElement.textContent = data.status;
        statusElement.className = `cohort-status status-${data.status.toLowerCase()}`;
      }
    }
  }

  /**
   * Show shareable link for cohort
   *
   * displayShareableLink builds the URL itself from the id, so it takes
   * (id, targetContainer, type) - see JobView.showShareableLink for the same
   * call. The container comes from querySelector as an Element, and
   * displayShareableLink rejects anything that is not an HTMLElement, so it is
   * narrowed here rather than asserted.
   *
   * @param {string} cohortId - Cohort ID
   */
  showShareableLink(cohortId) {
    const cohortElement = this.cohortElements.get(cohortId);
    if (!cohortElement) {
      return;
    }

    const linkContainer = cohortElement.querySelector('.cohort-shareable-link');
    if (linkContainer instanceof HTMLElement) {
      displayShareableLink(cohortId, linkContainer, 'cohort');
    }
  }

  /**
   * Add job to cohort display
   * @param {string} cohortId - Cohort ID
   * @param {HTMLElement} jobElement - Job element to add
   */
  addJobToCohort(cohortId, jobElement) {
    const cohortElement = this.cohortElements.get(cohortId);
    if (!cohortElement) {
      return;
    }

    const jobsContainer = cohortElement.querySelector('.cohort-jobs');
    if (jobsContainer) {
      jobsContainer.appendChild(jobElement);
    }
  }

  /**
   * Show cohort analysis section
   * @param {string} cohortId - Cohort ID
   */
  showAnalysisSection(cohortId, onAnalyze = null) {
    const cohortElement = this.cohortElements.get(cohortId);
    if (!cohortElement) {
      return;
    }

    const analysisSection = cohortElement.querySelector('.cohort-analysis');
    if (analysisSection) {
      analysisSection.classList.remove('hidden');
    }

    const analyzeBtn = cohortElement.querySelector('.cohort-analyze-btn');
    if (analyzeBtn instanceof HTMLButtonElement && onAnalyze) {
      analyzeBtn.onclick = () => onAnalyze(cohortId);
    }
  }

  /**
   * Update cohort analysis status
   * @param {string} cohortId - Cohort ID
   * @param {string} status - Analysis status
   * @param {string|null} [message=null] - Optional detailed status message
   */
  updateAnalysisStatus(cohortId, status, message = null) {
    const cohortElement = this.cohortElements.get(cohortId);
    if (!cohortElement) {
      return;
    }

    const statusElement = cohortElement.querySelector('.cohort-analysis-status');
    if (statusElement) {
      statusElement.textContent = message || this._formatStatus(status);
      statusElement.className = `cohort-analysis-status status-${status}`;
    }

    const analyzeBtn = cohortElement.querySelector('.cohort-analyze-btn');
    if (analyzeBtn instanceof HTMLButtonElement) {
      if (status === 'processing' || status === 'pending') {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Running Joint Analysis...';
      } else if (status === 'failed') {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Retry Joint Analysis';
      } else if (status === 'completed') {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analysis Completed';
      }
    }
  }

  /**
   * Update cohort display with completed analysis results
   * @param {string} cohortId - Cohort ID
   * @param {string} analysisJobId - Completed analysis job ID
   */
  updateAnalysisComplete(cohortId, analysisJobId) {
    const cohortElement = this.cohortElements.get(cohortId);
    if (!cohortElement) {
      return;
    }

    this.updateAnalysisStatus(cohortId, 'completed', 'Analysis Complete');

    const downloadContainer = cohortElement.querySelector('.cohort-analysis-download');
    if (downloadContainer) {
      downloadContainer.innerHTML = '';
      const downloadLink = document.createElement('a');
      const baseUrl =
        window.CONFIG && window.CONFIG.API_URL ? window.CONFIG.API_URL.replace(/\/$/, '') : '/api';
      downloadLink.href = `${baseUrl}/download/${encodeURIComponent(analysisJobId)}`;
      downloadLink.className = 'button button-success cohort-download-btn';
      downloadLink.setAttribute('download', `cohort_${cohortId}_results.zip`);
      downloadLink.textContent = 'Download Cohort Results (.zip)';
      downloadContainer.appendChild(downloadLink);
    }
  }

  /**
   * Remove cohort from UI
   * @param {string} cohortId - Cohort ID
   */
  removeCohort(cohortId) {
    const cohortElement = this.cohortElements.get(cohortId);
    if (cohortElement && cohortElement.parentNode) {
      cohortElement.parentNode.removeChild(cohortElement);
    }
    this.cohortElements.delete(cohortId);
  }

  /**
   * Clear all cohorts from UI
   */
  clearAll() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.cohortElements.clear();
  }

  /**
   * Create cohort UI element
   * @private
   */
  _createCohortElement(cohort, options = {}) {
    const cohortDiv = document.createElement('div');
    cohortDiv.className = 'cohort-section';
    cohortDiv.id = `cohort-${cohort.cohortId}`;

    // Cohort header
    const header = document.createElement('div');
    header.className = 'cohort-header';

    // Cohort title with alias or ID
    const title = document.createElement('h3');
    title.className = 'cohort-title';
    title.textContent = `Cohort: ${cohort.getDisplayName()}`;
    header.appendChild(title);

    // Cohort ID (if alias is shown)
    if (cohort.hasAlias()) {
      const idElement = createLabelValue('ID: ', cohort.cohortId, {
        containerClass: 'cohort-id-display',
        valueClass: 'cohort-id',
      });
      header.appendChild(idElement);
    }

    // Job count container with nested span so querySelector('.cohort-job-count') finds it
    const jobCountContainer = document.createElement('div');
    jobCountContainer.className = 'cohort-job-count-container';
    jobCountContainer.innerHTML = `<span class="cohort-job-count-label">Jobs: </span><span class="cohort-job-count">${cohort.getJobCount()}</span>`;
    header.appendChild(jobCountContainer);

    // Cohort status live region
    const status = document.createElement('div');
    status.className = 'cohort-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-atomic', 'true');
    header.appendChild(status);

    cohortDiv.appendChild(header);

    // Shareable link container (if provided)
    if (options.showShareableLink) {
      const linkContainer = document.createElement('div');
      linkContainer.className = 'cohort-shareable-link';
      cohortDiv.appendChild(linkContainer);
    }

    // Jobs container
    const jobsContainer = document.createElement('div');
    jobsContainer.className = 'cohort-jobs';
    cohortDiv.appendChild(jobsContainer);

    // Analysis section (hidden by default)
    const analysisSection = document.createElement('div');
    analysisSection.className = 'cohort-analysis hidden';

    const analysisTitle = document.createElement('h4');
    analysisTitle.className = 'cohort-analysis-title';
    analysisTitle.textContent = 'Joint Cohort Analysis';
    analysisSection.appendChild(analysisTitle);

    const analysisDesc = document.createElement('p');
    analysisDesc.className = 'cohort-analysis-desc';
    analysisDesc.textContent =
      'All cohort samples have completed processing. Run joint analysis to aggregate screening calls, compute cohort allele frequencies, and generate summary visualizations.';
    analysisSection.appendChild(analysisDesc);

    const analysisActions = document.createElement('div');
    analysisActions.className = 'cohort-analysis-actions';

    const analyzeBtn = document.createElement('button');
    analyzeBtn.type = 'button';
    analyzeBtn.className = 'button button-primary cohort-analyze-btn';
    analyzeBtn.setAttribute('data-cohort-id', cohort.cohortId);
    analyzeBtn.textContent = 'Run Joint Analysis';
    analysisActions.appendChild(analyzeBtn);
    analysisSection.appendChild(analysisActions);

    const analysisStatus = document.createElement('div');
    analysisStatus.className = 'cohort-analysis-status';
    analysisStatus.setAttribute('role', 'status');
    analysisStatus.setAttribute('aria-atomic', 'true');
    analysisSection.appendChild(analysisStatus);

    const analysisDownload = document.createElement('div');
    analysisDownload.className = 'cohort-analysis-download';
    analysisSection.appendChild(analysisDownload);

    cohortDiv.appendChild(analysisSection);

    return cohortDiv;
  }

  /**
   * Format status for display
   * @private
   */
  _formatStatus(status) {
    const statusMap = {
      pending: 'Pending',
      processing: 'Processing',
      completed: 'Completed',
      failed: 'Failed',
    };

    return statusMap[status] || status;
  }

  /**
   * Get cohort element
   * @param {string} cohortId - Cohort ID
   * @returns {HTMLElement|null} Cohort element
   */
  getCohortElement(cohortId) {
    return this.cohortElements.get(cohortId) || null;
  }

  /**
   * Check if cohort is displayed
   * @param {string} cohortId - Cohort ID
   * @returns {boolean} True if cohort is displayed
   */
  hasCohort(cohortId) {
    return this.cohortElements.has(cohortId);
  }
}
