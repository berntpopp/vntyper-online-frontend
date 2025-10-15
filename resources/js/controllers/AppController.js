// frontend/resources/js/controllers/AppController.js

import { BaseController } from './BaseController.js';
import { errorHandler } from '../errorHandling.js';
import { loadCohortFromURL } from '../jobManager.js';
import { Job } from '../models/Job.js';
import { blobManager } from '../blobManager.js';
import { logMessage } from '../log.js';

/**
 * App Controller - Main application lifecycle controller
 *
 * Purpose: Coordinates application initialization, routing, and top-level
 * event handling.
 *
 * Responsibilities:
 * - Application initialization
 * - URL routing (job/cohort loading from URL)
 * - Global event coordination
 * - Module initialization
 * - Application state reset
 *
 * SOLID Principles:
 * - Single Responsibility: Manages app lifecycle
 * - Open/Closed: Easy to extend with new initialization steps
 * - Dependency Inversion: Depends on controller abstractions
 *
 * @class AppController
 * @extends BaseController
 */
export class AppController extends BaseController {
    /**
     * @param {Object} dependencies - Injected dependencies
     */
    constructor(dependencies) {
        super(dependencies);

        this.jobController = dependencies.jobController;
        this.cohortController = dependencies.cohortController;
        this.fileController = dependencies.fileController;
        this.extractionController = dependencies.extractionController;
        this.errorView = dependencies.errorView;

        // Request guard flags (Performance: prevent duplicate submissions)
        this.isSubmitting = false;
        this.isExtracting = false;

        // Extraction mode flag (determines if download buttons should be shown)
        // true = "Extract Region" clicked, false = "Submit Jobs" clicked
        this.showDownloadButtons = false;

        // Button references (cached for performance)
        this.submitBtn = null;
        this.extractBtn = null;
        this.resetBtn = null;
    }

    /**
     * Initialize application
     */
    initialize() {
        this._log('Initializing application', 'info');

        // Register global error handlers
        errorHandler.registerGlobalHandlers();

        // Initialize UI components
        this.initializeUIComponents();

        // NOTE: URL routing is initialized in start() after all dependencies are injected

        // Initialize event listeners
        this.initializeEventListeners();

        this.emit('app:initialized');

        this._log('Application initialized successfully', 'success');
    }

    /**
     * Start application (called after all dependencies are injected)
     */
    start() {
        this._log('Starting application', 'info');

        // Initialize URL routing now that all dependencies are ready
        this.initializeRouting();

        this._log('Application started', 'success');
    }

    /**
     * Initialize UI components
     */
    initializeUIComponents() {
        // UI initialization is handled by individual modules
        // This is imported in main.js before AppController
        this._log('UI components initialized', 'info');
    }

    /**
     * Initialize URL routing
     */
    initializeRouting() {
        const urlParams = new URLSearchParams(window.location.search);

        // URL uses snake_case (job_id, cohort_id) not camelCase
        const jobId = urlParams.get('job_id');
        const cohortId = urlParams.get('cohort_id');
        const passphrase = urlParams.get('passphrase');

        if (jobId) {
            this._log(`Loading job from URL: ${jobId}`, 'info');
            this.loadJobFromURL(jobId);
        } else if (cohortId) {
            this._log(`Loading cohort from URL: ${cohortId}`, 'info');
            this.loadCohortFromURL(cohortId, passphrase);
        }
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        // Wire up submit button (cache reference for performance)
        this.submitBtn = document.getElementById('submitBtn');
        if (this.submitBtn) {
            this.submitBtn.addEventListener('click', () => this.handleSubmitClick());
        }

        // Wire up extract button (cache reference for performance)
        this.extractBtn = document.getElementById('extractBtn');
        if (this.extractBtn) {
            this.extractBtn.addEventListener('click', () => this.handleExtractClick());
        }

        // Wire up reset button (cache reference for performance)
        this.resetBtn = document.getElementById('resetFileSelectionBtn');
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleResetClick();
            });
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        this.on('app:reset', this.handleReset);
        this.on('app:error', this.handleAppError);
        this.on('extraction:complete', this.handleExtractionComplete);
    }

    /**
     * Handle submit button click
     */
    async handleSubmitClick() {
        // Guard against duplicate submissions (Performance: prevent double-clicks)
        if (this.isSubmitting) {
            this._log('Submit already in progress, ignoring click', 'warning');
            return;
        }

        // Cache original button text
        const originalText = this.submitBtn?.textContent || 'Submit Job';

        try {
            // Set submitting state and disable button
            this.isSubmitting = true;
            if (this.submitBtn) {
                this.submitBtn.disabled = true;
                this.submitBtn.textContent = 'Submitting...';
            }

            // IMPORTANT: Don't show download buttons during job submission
            // Extraction is only for preparing files to send to backend
            this.showDownloadButtons = false;

            // Clear any existing download buttons from regionOutput
            const regionOutputDiv = document.getElementById('regionOutput');
            if (regionOutputDiv) {
                regionOutputDiv.innerHTML = '';
            }

            // Get selected files
            const selectedFiles = this.fileController.getSelectedFiles();

            if (!selectedFiles || selectedFiles.length === 0) {
                this.errorView?.showValidation('No files selected. Please upload BAM and BAI files.');
                this._log('No files selected', 'warning');
                return;
            }

            this._log('Submit button clicked', 'info', { fileCount: selectedFiles.length });

            // Validate files
            const { matchedPairs, invalidFiles } = await this.fileController.handleValidation({
                files: selectedFiles,
                showErrors: true
            });

            if (matchedPairs.length === 0) {
                return;
            }

            // Get form inputs
            const emailInput = document.getElementById('email');
            const cohortAliasInput = document.getElementById('cohortAlias');
            const passphraseInput = document.getElementById('passphrase');
            const advntrModeCheckbox = document.getElementById('advntrMode');

            const email = emailInput?.value?.trim() || null;
            const cohortAlias = cohortAliasInput?.value?.trim() || null;
            const passphrase = passphraseInput?.value?.trim() || null;
            const advntrMode = advntrModeCheckbox?.checked || false;

            // Create cohort if multiple files
            let cohortId = null;
            if (matchedPairs.length > 1) {
                const cohort = await this.cohortController.handleCreate({
                    alias: cohortAlias,
                    passphrase
                });
                cohortId = cohort.cohortId;
            }

            // Process each file pair
            for (const pair of matchedPairs) {
                // Extract region
                const extractionResult = await this.extractionController.handleExtract({ pair });

                // Prepare FormData
                const formData = new FormData();

                // Add extracted blobs
                extractionResult.subsetBamAndBaiBlobs.forEach(subset => {
                    formData.append('bam_file', subset.subsetBamBlob, subset.subsetName);
                    formData.append('bai_file', subset.subsetBaiBlob, `${subset.subsetName}.bai`);
                });

                // Add parameters
                formData.append('reference_assembly', extractionResult.detectedAssembly);
                formData.append('region', extractionResult.region);
                formData.append('fast_mode', 'true');
                formData.append('keep_intermediates', 'true');
                formData.append('archive_results', 'true');
                formData.append('advntr_mode', advntrMode ? 'true' : 'false');

                if (email) {
                    formData.append('email', email);
                }

                // Get file name (handle both BAM and SAM files)
                const fileName = pair.bam?.name || pair.sam?.name || 'unknown';

                // Submit job
                await this.jobController.handleSubmit({
                    formData,
                    cohortId,
                    passphrase,
                    fileName
                });
            }

            // Start cohort polling if needed
            if (cohortId) {
                await this.cohortController.handlePoll({ cohortId, passphrase });
            }

        } catch (error) {
            this.handleError(error, 'Submit failed');
        } finally {
            // Always re-enable button and restore state
            this.isSubmitting = false;
            if (this.submitBtn) {
                this.submitBtn.disabled = false;
                this.submitBtn.textContent = originalText;
            }
        }
    }

    /**
     * Handle extract button click
     */
    async handleExtractClick() {
        // Guard against duplicate extractions (Performance: prevent double-clicks)
        if (this.isExtracting) {
            this._log('Extract already in progress, ignoring click', 'warning');
            return;
        }

        // Cache original button text
        const originalText = this.extractBtn?.textContent || 'Extract Region';

        try {
            // Set extracting state and disable button
            this.isExtracting = true;
            if (this.extractBtn) {
                this.extractBtn.disabled = true;
                this.extractBtn.textContent = 'Extracting...';
            }

            // IMPORTANT: Show download buttons for local extraction
            // User wants to download the extracted region files locally
            this.showDownloadButtons = true;

            this._log('Extract button clicked', 'info');

            // Get selected files
            const selectedFiles = this.fileController.getSelectedFiles();

            if (!selectedFiles || selectedFiles.length === 0) {
                this.errorView?.showValidation('No files selected. Please upload BAM and BAI files.');
                this._log('No files selected', 'warning');
                return;
            }

            // Validate files
            const { matchedPairs } = await this.fileController.handleValidation({
                files: selectedFiles,
                showErrors: true
            });

            if (matchedPairs.length === 0) {
                return;
            }

            // Extract all pairs
            await this.extractionController.extractMultiple(matchedPairs);

        } catch (error) {
            this.handleError(error, 'Extract failed');
        } finally {
            // Always re-enable button and restore state
            this.isExtracting = false;
            if (this.extractBtn) {
                this.extractBtn.disabled = false;
                this.extractBtn.textContent = originalText;
            }
        }
    }

    /**
     * Handle reset button click
     */
    handleResetClick() {
        this._log('Reset button clicked', 'info');
        this.emit('app:reset');
    }

    /**
     * Handle application reset
     */
    handleReset() {
        this._log('Resetting application', 'info');

        // Clear file selection
        this.fileController.handleClear();

        // Clear UI
        this.jobController.jobView.clearAll();
        this.cohortController.cohortView.clearAll();

        // Clear download buttons area
        const regionOutputDiv = document.getElementById('regionOutput');
        if (regionOutputDiv) {
            regionOutputDiv.innerHTML = '';
        }

        // Reset extraction mode flag
        this.showDownloadButtons = false;

        // Clear form inputs
        const emailInput = document.getElementById('email');
        const cohortAliasInput = document.getElementById('cohortAlias');
        const passphraseInput = document.getElementById('passphrase');

        if (emailInput) emailInput.value = '';
        if (cohortAliasInput) cohortAliasInput.value = '';
        if (passphraseInput) passphraseInput.value = '';

        this.emit('app:reset:complete');

        this._log('Application reset complete', 'info');
    }

    /**
     * Handle application-level errors
     * @param {Object} errorData - Error data
     */
    handleAppError(errorData) {
        this._log('Application error', 'error', errorData);
        // Could add centralized error reporting here
    }

    /**
     * Handle extraction complete event - create download UI
     * @param {Object} eventData - Event data from ExtractionController
     * @param {Object} eventData.pair - The BAM/BAI file pair
     * @param {Object} eventData.result - Full extraction result
     * @param {Array} eventData.subsetBamAndBaiBlobs - Array of {subsetBamBlob, subsetBaiBlob, subsetName}
     * @param {string} eventData.detectedAssembly - Detected assembly
     * @param {string} eventData.region - Extracted region
     */
    handleExtractionComplete({ pair, result, subsetBamAndBaiBlobs, detectedAssembly, region }) {
        this._log('Handling extraction complete', 'info', { showDownloadButtons: this.showDownloadButtons });

        // CRITICAL: Only show download buttons when "Extract Region" was clicked
        // When "Submit Jobs" is clicked, extraction happens internally but should not show download UI
        if (!this.showDownloadButtons) {
            this._log('Skipping download UI creation (job submission mode)', 'info');
            return;
        }

        this._log('Creating download UI for local extraction', 'info');

        const regionOutputDiv = document.getElementById('regionOutput');
        if (!regionOutputDiv) {
            this._log('regionOutput div not found', 'error');
            return;
        }

        // Clear previous output
        regionOutputDiv.innerHTML = '';

        const createdUrls = [];

        // Create download links for each subset
        subsetBamAndBaiBlobs.forEach((subset) => {
            const { subsetBamBlob, subsetBaiBlob, subsetName } = subset;
            const subsetBaiName = `${subsetName}.bai`;

            // Use blobManager to track URLs for automatic cleanup
            const downloadBamUrl = blobManager.create(subsetBamBlob, {
                filename: subsetName,
                type: 'BAM'
            });
            const downloadBaiUrl = blobManager.create(subsetBaiBlob, {
                filename: subsetBaiName,
                type: 'BAI'
            });

            createdUrls.push(downloadBamUrl, downloadBaiUrl);

            // Download Link for BAM
            const downloadBamLink = document.createElement('a');
            downloadBamLink.href = downloadBamUrl;
            downloadBamLink.download = subsetName;
            downloadBamLink.textContent = `Download ${subsetName}`;
            downloadBamLink.classList.add('download-link', 'download-button');
            downloadBamLink.setAttribute('aria-label', `Download subset BAM file ${subsetName}`);

            // Download Link for BAI
            const downloadBaiLink = document.createElement('a');
            downloadBaiLink.href = downloadBaiUrl;
            downloadBaiLink.download = subsetBaiName;
            downloadBaiLink.textContent = `Download ${subsetBaiName}`;
            downloadBaiLink.classList.add('download-link', 'download-button');
            downloadBaiLink.setAttribute('aria-label', `Download subset BAI file ${subsetBaiName}`);

            // Create a container for the download links
            const linkContainer = document.createElement('div');
            linkContainer.classList.add('download-container', 'mb-2');
            linkContainer.appendChild(downloadBamLink);
            linkContainer.appendChild(downloadBaiLink);

            // Append the container to the regionOutput div
            regionOutputDiv.appendChild(linkContainer);

            // Create and append the horizontal divider after the container
            const divider = document.createElement('hr');
            divider.classList.add('separator');
            regionOutputDiv.appendChild(divider);

            logMessage(`Download links provided for ${subsetName} and ${subsetBaiName}.`, 'info');
        });

        // Revoke blob URLs after user has had time to download (5 minutes)
        // blobManager will also auto-cleanup old URLs periodically
        setTimeout(() => {
            const revokedCount = blobManager.revokeMultiple(createdUrls);
            logMessage(`Revoked ${revokedCount} Blob URLs from region extraction`, 'info');
        }, 300000); // 5 minutes

        this._log('Download UI created successfully', 'success');
    }

    /**
     * Load job from URL
     * @param {string} jobId - Job ID
     */
    async loadJobFromURL(jobId) {
        try {
            this._log(`Loading job from URL: ${jobId}`, 'info');

            // Validate job ID
            if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
                throw new Error('Invalid Job ID provided');
            }

            // Debug: Check if jobController exists
            if (!this.jobController) {
                throw new Error('JobController not initialized');
            }

            if (!this.jobController.apiService) {
                throw new Error('APIService not available on JobController');
            }

            // Get job status from API
            const statusData = await this.jobController.apiService.getJobStatus(jobId);

            // Create job from status data
            const job = Job.fromAPI({
                job_id: jobId,
                status: statusData.status,
                ...statusData
            });

            // Add to state
            this.jobController.stateManager.addJob(jobId, {
                status: job.status,
                createdAt: Date.now()
            });

            // Show in UI
            this.jobController.jobView.showJob(job);

            // Start polling if job is active
            if (!job.isTerminal()) {
                this.jobController.emit('job:poll', { jobId });
            } else if (job.isCompleted()) {
                // Show download link if already complete
                this.jobController.jobView.showDownloadLink(jobId);
            } else if (job.isFailed()) {
                // Show error if failed
                this.jobController.jobView.showError(jobId, statusData.error || 'Job failed');
            }

            this.emit('app:job:loaded', { jobId });
        } catch (error) {
            this.handleError(error, `Failed to load job ${jobId}`);
            this.errorView?.show(error, 'Load Job from URL');
        }
    }

    /**
     * Load cohort from URL
     * @param {string} cohortId - Cohort ID
     * @param {string} [passphrase] - Optional passphrase
     */
    async loadCohortFromURL(cohortId, passphrase) {
        try {
            await loadCohortFromURL(cohortId, passphrase);
            this.emit('app:cohort:loaded', { cohortId });
        } catch (error) {
            this.handleError(error, `Failed to load cohort ${cohortId}`);
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Cleanup all controllers
        this.jobController?.cleanup();
        this.cohortController?.cleanup();
        this.extractionController?.cleanup();

        this._log('Cleanup complete', 'info');
    }
}
