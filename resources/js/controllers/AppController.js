// frontend/resources/js/controllers/AppController.js

import { BaseController } from './BaseController.js';
import { errorHandler } from '../errorHandling.js';
import { loadCohortFromURL } from '../jobManager.js';
import { Job } from '../models/Job.js';

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
        // Wire up submit button
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.handleSubmitClick());
        }

        // Wire up extract button
        const extractBtn = document.getElementById('extractBtn');
        if (extractBtn) {
            extractBtn.addEventListener('click', () => this.handleExtractClick());
        }

        // Wire up reset button
        const resetBtn = document.getElementById('resetFileSelectionBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
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
    }

    /**
     * Handle submit button click
     */
    async handleSubmitClick() {
        try {
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
        }
    }

    /**
     * Handle extract button click
     */
    async handleExtractClick() {
        try {
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
