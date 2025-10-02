// frontend/resources/js/views/CohortView.js

import { createLabelValue, createTextElement } from '../domHelpers.js';
import { safeGetElementById } from '../domHelpers.js';
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
     * @param {Cohort} cohort - Cohort model
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
     * @param {string} cohortId - Cohort ID
     * @param {string} link - Shareable link
     */
    showShareableLink(cohortId, link) {
        const cohortElement = this.cohortElements.get(cohortId);
        if (!cohortElement) {
            return;
        }

        const linkContainer = cohortElement.querySelector('.cohort-shareable-link');
        if (linkContainer) {
            displayShareableLink(link, cohortId, linkContainer);
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
    showAnalysisSection(cohortId) {
        const cohortElement = this.cohortElements.get(cohortId);
        if (!cohortElement) {
            return;
        }

        const analysisSection = cohortElement.querySelector('.cohort-analysis');
        if (analysisSection) {
            analysisSection.classList.remove('hidden');
        }
    }

    /**
     * Update cohort analysis status
     * @param {string} cohortId - Cohort ID
     * @param {string} status - Analysis status
     */
    updateAnalysisStatus(cohortId, status) {
        const cohortElement = this.cohortElements.get(cohortId);
        if (!cohortElement) {
            return;
        }

        const statusElement = cohortElement.querySelector('.cohort-analysis-status');
        if (statusElement) {
            statusElement.textContent = this._formatStatus(status);
            statusElement.className = `cohort-analysis-status status-${status}`;
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
                valueClass: 'cohort-id'
            });
            header.appendChild(idElement);
        }

        // Job count
        const jobCount = createTextElement('div', `Jobs: ${cohort.getJobCount()}`, {
            className: 'cohort-job-count-container'
        });
        header.appendChild(jobCount);

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
        analysisTitle.textContent = 'Cohort Analysis';
        analysisSection.appendChild(analysisTitle);

        const analysisStatus = document.createElement('div');
        analysisStatus.className = 'cohort-analysis-status';
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
            'pending': 'Pending',
            'processing': 'Processing',
            'completed': 'Completed',
            'failed': 'Failed'
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
