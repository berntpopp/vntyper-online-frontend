// frontend/resources/js/main.js

import { validateFiles } from './inputWrangling.js';
import {
    submitJobToAPI,
    pollJobStatusAPI,
    getCohortStatus,
    createCohort,
    pollCohortStatusAPI,
} from './apiInteractions.js';
import { initializeAioli, extractRegionAndIndex } from './bamProcessing.js';
import { initializeModal } from './modal.js';
import { initializeFooter } from './footer.js';
import { initializeDisclaimer } from './disclaimer.js';
import { initializeFAQ } from './faq.js';
import { initializeUserGuide } from './userGuide.js';
import { initializeCitations } from './citations.js';
import { initializeTutorial } from './tutorial.js';
import { initializeUsageStats } from './usageStats.js';
import { regions } from './regionsConfig.js';
import { displayError, clearError, errorHandler, ErrorLevel } from './errorHandling.js';
import { createLabelValue, replaceLabelValue, safeGetElementById } from './domHelpers.js';
import { blobManager } from './blobManager.js';
import { stateManager } from './stateManager.js';
import { validateJobId, validateCohortId } from './validators.js';
import {
    showSpinner,
    hideSpinner,
    startCountdown,
    resetCountdown,
    clearCountdown,
    initializeUIUtils,
    displayMessage,
    clearMessage,
    displayShareableLink,
    hidePlaceholderMessage,
    showPlaceholderMessage,
    displayDownloadLink,
} from './uiUtils.js';
import { initializeFileSelection } from './fileSelection.js';
import { initializeServerLoad } from './serverLoad.js';
import { logMessage, initializeLogging } from './log.js';
import {
    fetchAndUpdateJobStatus,
    loadJobFromURL,
    loadCohortFromURL,
} from './jobManager.js';

/**
 * Generates a default alias for cohorts without a user-provided alias.
 * @returns {string} - A default cohort alias.
 */
function generateDefaultCohortAlias() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `Cohort-${timestamp}`;
}

/**
 * Initializes the application by setting up event listeners and dynamic content.
 */
async function initializeApp() {
    // Register global error handlers FIRST to catch any initialization errors
    errorHandler.registerGlobalHandlers();

    try {
        // Initialize modal and footer functionalities
        initializeModal();
        initializeFooter();
        initializeDisclaimer();

    // Initialize other sections
    initializeFAQ();
    initializeUserGuide();
    initializeCitations();
    initializeTutorial();

    // Initialize UI Utilities (includes toggle functionality)
    initializeUIUtils();
    logMessage('UI utilities initialized.', 'info');

    // Initialize Logging System
    initializeLogging();
    logMessage('Application initialized.', 'info');

    // Initialize Usage Statistics Panel
    initializeUsageStats();

    // Define displayedCohorts at a higher scope
    const displayedCohorts = new Set();

    // Get references to DOM elements
    const submitBtn = document.getElementById('submitBtn');
    const extractBtn = document.getElementById('extractBtn');
    const cohortAliasInput = document.getElementById('cohortAlias');
    const passphraseInput = document.getElementById('passphrase');
    const regionSelect = document.getElementById('region');
    const regionOutputDiv = document.getElementById('regionOutput');
    const emailInput = document.getElementById('email');

    // Initialize file selection
    let selectedFiles = [];
    const fileSelection = initializeFileSelection(selectedFiles);
    const { displaySelectedFiles } = fileSelection; // no changes, keep onFilesSelected if needed

    // ***********************************************************************
    // NEW: Add a function to reset the entire application state
    // ***********************************************************************
    function resetApplicationState() {
        // Clear dynamic output areas
        const jobOutputDiv = document.getElementById('jobOutput');
        if (jobOutputDiv) {
            jobOutputDiv.innerHTML = '';
        }
        const cohortsContainerDiv = document.getElementById('cohortsContainer');
        if (cohortsContainerDiv) {
            cohortsContainerDiv.innerHTML = '';
        }
        if (regionOutputDiv) {
            regionOutputDiv.innerHTML = '';
        }
        // Clear error and message displays
        clearError();
        clearMessage();
        // Reset the region select to its default value ('guess')
        if (regionSelect) {
            regionSelect.value = 'guess';
        }
        // Clear any displayed cohorts
        displayedCohorts.clear();
        // Clear any active countdown and hide the spinner
        clearCountdown();
        hideSpinner();
        logMessage('Application state has been reset.', 'info');
    }
    // ***********************************************************************

    /**
     * Capitalizes the first letter of a string.
     * @param {string} string - The string to capitalize.
     * @returns {string} - The capitalized string.
     */
    function capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    /**
     * Checks URL parameters for job_id and cohort_id and loads the respective details.
     */
    function checkURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const rawJobId = urlParams.get('job_id');
        const rawCohortId = urlParams.get('cohort_id');

        // Validate URL parameters (XSS/injection protection)
        const cohortId = validateCohortId(rawCohortId);
        const jobId = validateJobId(rawJobId);

        // If invalid IDs were provided, show error
        if (rawCohortId && !cohortId) {
            displayError('Invalid cohort ID in URL');
            logMessage(`Invalid cohort ID rejected: ${rawCohortId}`, 'warning');
            return;
        }
        if (rawJobId && !jobId) {
            displayError('Invalid job ID in URL');
            logMessage(`Invalid job ID rejected: ${rawJobId}`, 'warning');
            return;
        }

        if (cohortId) {
            const passphrase = passphraseInput.value.trim() || null;
            loadCohortFromURL(cohortId, {
                showSpinner,
                hideSpinner,
                clearError,
                clearMessage,
                jobInfoDiv: outputDiv, // Display in output div for cohort
                regionOutputDiv,
                displayShareableLink,
                pollCohortStatusAPI,
                fetchAndUpdateJobStatus,
                resetCountdown,
                logMessage,
                serverLoad,
                displayedCohorts, // Pass the existing Set
                cohortsContainer: document.getElementById('cohortsContainer'), // Pass the cohorts container
                passphrase, // Passphrase captured here
            });
        } else if (jobId) {
            const passphrase = passphraseInput.value.trim() || null;
            loadJobFromURL(jobId, {
                showSpinner,
                hideSpinner,
                clearError,
                clearMessage,
                jobInfoDiv: document.getElementById('jobOutput'), // Display in jobOutputDiv for individual jobs
                regionOutputDiv,
                displayShareableLink,
                pollJobStatusAPI,
                fetchAndUpdateJobStatus,
                resetCountdown,
                logMessage,
                serverLoad,
                displayedCohorts, // Pass the existing Set
                cohortsContainer: document.getElementById('cohortsContainer'), // Pass the cohorts container
                passphrase, // Passphrase captured here
            });
        }
    }

    // ***********************************************************************
    // NEW: Reset File Selection Button handling now resets entire application state
    // ***********************************************************************
    const resetFileSelectionBtn = document.getElementById('resetFileSelectionBtn');
    if (resetFileSelectionBtn) {
        // Add a hover title to explain its use
        resetFileSelectionBtn.setAttribute('title', 'Reset file selection and application state');
        resetFileSelectionBtn.addEventListener('click', (event) => {
            // Stop propagation so it doesn't trigger file selection
            event.stopPropagation();
            fileSelection.resetFileSelection();
            resetApplicationState();
            logMessage('Application state and file selection have been reset.', 'info');
        });
    }
    // ***********************************************************************

    // Initialize server load monitoring
    const serverLoad = initializeServerLoad();

    // References to output sub-containers
    const outputDiv = document.getElementById('output');
    const jobOutputDiv = document.getElementById('jobOutput');
    const cohortsContainerDiv = document.getElementById('cohortsContainer');

    /**
     * Handle Job Submission via Submit Button
     */
    submitBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) {
            displayError('No files selected. Please upload BAM and BAI files.');
            logMessage('Attempted to submit job without selecting files.', 'warning');
            return;
        }

        try {
            // Clear previous job outputs and errors, but preserve essential elements
            jobOutputDiv.innerHTML = ''; // Clear individual job outputs
            cohortsContainerDiv.innerHTML = ''; // Clear cohorts if any
            regionOutputDiv.innerHTML = '';
            clearError();
            clearMessage();
            hidePlaceholderMessage(); // Hide placeholder when submitting a job

            // Show spinner and initialize countdown
            showSpinner();
            startCountdown();
            logMessage('Job submission started.', 'info');

            // Initialize Aioli and validate selected files
            const CLI = await initializeAioli();
            const { matchedPairs, invalidFiles } = validateFiles(selectedFiles, false);

            if (invalidFiles.length > 0) {
                displayError(
                    `Some files were invalid and not added: ${invalidFiles.map((f) => f.name).join(', ')}`
                );
                logMessage('Invalid files detected during submission.', 'warning');
            }

            if (matchedPairs.length === 0) {
                displayError('No valid BAM and BAI file pairs found for submission.');
                logMessage('No valid file pairs found for submission.', 'warning');
                hideSpinner(); // Hide spinner since there's nothing to poll
                clearCountdown();
                return;
            }

            // Capture email, cohort alias, and passphrase inputs
            const email = emailInput.value.trim() || null;
            const cohortAlias = cohortAliasInput.value.trim() || null;
            const passphrase = passphraseInput.value.trim() || null; // Captured Passphrase

            let cohortId = null;

            // Always create a cohort when multiple files are submitted
            if (matchedPairs.length > 1) {
                try {
                    // If no alias is provided, generate a default one
                    const aliasToUse = cohortAlias || generateDefaultCohortAlias();
                    const cohortData = await createCohort(aliasToUse, passphrase); // Pass alias and passphrase
                    cohortId = cohortData.cohort_id; // Retrieve cohort_id from response
                    logMessage(`Cohort created with ID: ${cohortId}`, 'info');

                    // Create a cohort section within the cohortsContainerDiv
                    const cohortSection = document.createElement('div');
                    cohortSection.id = `cohort-${cohortId}`; // Unique ID to prevent duplicates
                    cohortSection.classList.add('cohort-section');

                    const cohortInfo = document.createElement('div');
                    cohortInfo.classList.add('cohort-info');

                    // XSS-safe: Use DOM API instead of innerHTML
                    cohortInfo.appendChild(document.createTextNode('Cohort Alias: '));
                    const aliasStrong = document.createElement('strong');
                    aliasStrong.textContent = cohortData.alias || 'N/A';
                    cohortInfo.appendChild(aliasStrong);
                    cohortInfo.appendChild(document.createTextNode(' | Cohort ID: '));
                    const idStrong = document.createElement('strong');
                    idStrong.textContent = cohortId;
                    cohortInfo.appendChild(idStrong);

                    const jobsContainer = document.createElement('div');
                    jobsContainer.id = `jobs-container-${cohortId}`;
                    jobsContainer.classList.add('jobs-container');

                    cohortSection.appendChild(cohortInfo);
                    cohortSection.appendChild(jobsContainer);
                    cohortsContainerDiv.appendChild(cohortSection);
                    logMessage(`Cohort section created for Cohort ID: ${cohortId}`, 'info');

                    // Add to displayed cohorts
                    displayedCohorts.add(cohortId);
                } catch (cohortError) {
                    // Handle cohort creation error
                    displayError(`Cohort Creation Failed: ${cohortError.message}`);
                    logMessage(`Cohort creation failed: ${cohortError.message}`, 'error');
                    hideSpinner(); // Hide spinner since cohort creation failed
                    clearCountdown();
                    return;
                }
            }

            // Iterate through each matched pair and submit jobs sequentially
            const jobIds = [];

            for (const pair of matchedPairs) {
                const { bam, bai } = pair;

                // Extract region and detect assembly
                const { subsetBamAndBaiBlobs, detectedAssembly, region } = await extractRegionAndIndex(CLI, pair);
                logMessage('Subset BAM and BAI Blobs created.', 'info');
                logMessage(`Detected Assembly: ${detectedAssembly}`, 'info');
                logMessage(`Region used: ${region}`, 'info');

                // Prepare FormData with subsetted BAM and BAI files
                const formData = new FormData();

                subsetBamAndBaiBlobs.forEach((subset) => {
                    const { subsetBamBlob, subsetBaiBlob, subsetName } = subset;
                    const subsetBamFileName = subsetName; // e.g., subset_test.bam
                    const subsetBaiFileName = `${subsetName}.bai`; // e.g., subset_test.bam.bai

                    formData.append('bam_file', subsetBamBlob, subsetBamFileName);
                    formData.append('bai_file', subsetBaiBlob, subsetBaiFileName);
                });

                // Use the detected assembly and region
                formData.append('reference_assembly', detectedAssembly);
                formData.append('region', region);

                // Add additional parameters
                formData.append('fast_mode', 'true');
                formData.append('keep_intermediates', 'true');
                formData.append('archive_results', 'true');

                // NEW: Append the advntr_mode parameter based on checkbox state
                const advntrModeCheckbox = document.getElementById('advntrMode');
                const advntrMode = advntrModeCheckbox && advntrModeCheckbox.checked;
                formData.append('advntr_mode', advntrMode ? 'true' : 'false');
                logMessage(`adVNTR analysis mode set to ${advntrMode}`, 'info');

                // Add email and cohort information if available
                if (email) {
                    formData.append('email', email);
                    logMessage(`Email ${email} added to job submission.`, 'info');
                }
                if (cohortId) {
                    formData.append('cohort_id', cohortId);
                    logMessage(`Cohort ID ${cohortId} added to job submission.`, 'info');
                }

                // Submit job to API
                try {
                    const data = await submitJobToAPI(formData, cohortId, passphrase); // Pass cohortId and passphrase here
                    logMessage(`Job submitted successfully! Job ID: ${data.job_id}`, 'success');

                    jobIds.push(data.job_id);

                    // Create job information element (XSS-safe)
                    const jobInfo = document.createElement('div');
                    jobInfo.classList.add('job-info');
                    jobInfo.appendChild(document.createTextNode('Job ID: '));
                    const jobIdStrong = document.createElement('strong');
                    jobIdStrong.textContent = data.job_id;
                    jobInfo.appendChild(jobIdStrong);

                    // Create job status element (XSS-safe)
                    const jobStatus = document.createElement('div');
                    jobStatus.id = `status-${data.job_id}`; // Unique ID
                    jobStatus.classList.add('job-status');
                    jobStatus.appendChild(document.createTextNode('Status: '));
                    const statusStrong = document.createElement('strong');
                    statusStrong.textContent = 'Submitted';
                    jobStatus.appendChild(statusStrong);

                    // Determine the target container
                    let targetContainer;
                    if (cohortId) {
                        targetContainer = document.getElementById(`jobs-container-${cohortId}`);
                    } else {
                        targetContainer = jobOutputDiv; // For individual job submissions without cohort
                    }

                    // Append job info and status to the target container
                    targetContainer.appendChild(jobInfo);
                    targetContainer.appendChild(jobStatus);

                    // Generate and display shareable link
                    displayShareableLink(data.job_id, targetContainer); // Pass targetContainer
                } catch (jobError) {
                    displayError(`Job Submission Failed: ${jobError.message}`);
                    logMessage(`Job submission failed: ${jobError.message}`, 'error');
                }
            }

            // After submitting all jobs, start polling
            if (cohortId) {
                // Polling for cohort status
                const passphrase = passphraseInput.value.trim() || null;

                const stopPolling = pollCohortStatusAPI(
                    cohortId,
                    async () => {
                        const cohortStatus = await getCohortStatus(cohortId, passphrase, cohortAlias);
                        fetchAndUpdateJobStatus(cohortId, cohortStatus, {
                            hidePlaceholderMessage,
                            logMessage,
                            clearCountdown,
                            stopPolling, // Pass the actual stopPolling function
                            passphrase, // Passphrase captured here
                            displayedCohorts, // Ensure displayedCohorts is included
                        });
                    },
                    () => {
                        // On Complete
                        hideSpinner();
                        clearCountdown();
                        logMessage(`Cohort ID ${cohortId} polling completed.`, 'success');
                        serverLoad.updateServerLoad(cohortId); // Pass cohortId here
                        displayedCohorts.delete(cohortId); // Clean up after completion
                    },
                    (errorMessage) => {
                        // On Error
                        displayError(errorMessage);
                        logMessage(`Cohort ID ${cohortId} encountered an error: ${errorMessage}`, 'error');
                        hideSpinner();
                        clearCountdown();
                        serverLoad.updateServerLoad(cohortId);
                        displayedCohorts.delete(cohortId);
                    },
                    null,
                    passphrase // Passphrase passed to pollCohortStatusAPI
                );

                // No need to store the stopper function in main.js as apiInteractions.js manages it
            } else {
                // Polling for individual jobs in single mode
                if (jobIds.length > 0) {
                    jobIds.forEach((jobId) => {
                        // Start polling job status
                        pollJobStatusAPI(
                            jobId,
                            async (status) => {
                                // Update job status in the UI (XSS-safe)
                                const jobStatusDivElement = document.getElementById(`status-${jobId}`);
                                if (jobStatusDivElement) {
                                    // Clear and rebuild content safely
                                    jobStatusDivElement.textContent = '';
                                    jobStatusDivElement.appendChild(document.createTextNode('Status: '));
                                    const statusStrong = document.createElement('strong');
                                    statusStrong.textContent = capitalizeFirstLetter(status);
                                    jobStatusDivElement.appendChild(statusStrong);
                                }

                                // Display Download and Copy Buttons When Job is Completed
                                if (status === 'completed') {
                                    logMessage(`🎉 Job ${jobId} status changed to completed. Calling displayDownloadLink...`, 'success');
                                    displayDownloadLink(jobId, {
                                        hidePlaceholderMessage,
                                        jobStatusDiv: jobStatusDivElement,
                                        clearCountdown,
                                    });
                                    logMessage(`Calling displayShareableLink...`, 'info');
                                    displayShareableLink(jobId, jobStatusDivElement.parentElement); // Pass the job container as targetContainer
                                    logMessage(`displayShareableLink completed.`, 'info');
                                } else if (status === 'failed') {
                                    const errorMessage = 'Job failed.'; // Customize as needed
                                    displayError(errorMessage);
                                    logMessage(`Job ID ${jobId} failed with error: ${errorMessage}`, 'error');
                                } else {
                                    logMessage(`Job ID ${jobId} is currently ${status}.`, 'info');
                                }
                            },
                            () => {
                                // On Complete
                                hideSpinner();
                                clearCountdown();
                                logMessage(`Job ID ${jobId} has been completed.`, 'success');
                                serverLoad.updateServerLoad(jobId); // Pass jobId here
                            },
                            (errorMessage) => {
                                // On Error
                                displayError(errorMessage);
                                logMessage(`Job ID ${jobId} encountered an error: ${errorMessage}`, 'error');
                                hideSpinner();
                                clearCountdown();
                                serverLoad.updateServerLoad(jobId); // Pass jobId here
                            },
                            null,
                            null
                        );
                    });
                }
            }

            selectedFiles = [];
            displaySelectedFiles(selectedFiles);
            logMessage('All selected files have been submitted.', 'info');
        } catch (err) {
            logMessage(`Error during job submission: ${err.message}`, 'error');
            hideSpinner(); // Hide spinner on unexpected errors
            clearCountdown();
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Jobs';
            // Removed hideSpinner() from here as it's handled above
        }
    });

    /**
     * Handle Region Extraction via Extract Button
     */
    extractBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) {
            displayError('No files selected. Please upload BAM and BAI files.');
            logMessage('Attempted to extract region without selecting files.', 'warning');
            return;
        }

        try {
            // Clear previous outputs and errors
            regionOutputDiv.innerHTML = '';
            clearError();
            clearMessage();
            hidePlaceholderMessage(); // Hide placeholder when extracting region

            // Show spinner and initialize countdown
            showSpinner();
            startCountdown();
            logMessage('Region extraction started.', 'info');

            const CLI = await initializeAioli();
            const { matchedPairs, invalidFiles } = validateFiles(selectedFiles, false);

            if (invalidFiles.length > 0) {
                displayError(`Some files were invalid and not added: ${invalidFiles.map((f) => f.name).join(', ')}`);
                logMessage('Invalid files detected during region extraction.', 'warning');
            }

            if (matchedPairs.length === 0) {
                displayError('No valid BAM and BAI file pairs found for extraction.');
                logMessage('No valid file pairs found for region extraction.', 'warning');
                hideSpinner(); // Hide spinner since extraction cannot proceed
                clearCountdown();
                return;
            }

            // Extract region and detect assembly for each pair
            for (const pair of matchedPairs) {
                const { subsetBamAndBaiBlobs, detectedAssembly, region } = await extractRegionAndIndex(CLI, pair);
                logMessage('Subset BAM and BAI Blobs created during extraction.', 'info');
                logMessage(`Detected Assembly: ${detectedAssembly}`, 'info');
                logMessage(`Region used: ${region}`, 'info');                // Only display "Detected reference assembly..." if user had chosen "Guess assembly"
                if (detectedAssembly && regionSelect.value === 'guess') {
                    regionSelect.value = detectedAssembly;
                    
                    // Check if there's already a warning message displayed and preserve it
                    const messageDiv = document.getElementById('message');
                    const hasWarning = messageDiv && messageDiv.classList.contains('message-warning');
                    const existingWarning = hasWarning ? messageDiv.innerHTML : '';
                    
                    const assemblyMessage = `Detected reference assembly: ${detectedAssembly.toUpperCase()}. Please confirm or select manually.`;
                    
                    if (hasWarning && existingWarning) {
                        // Combine warning with assembly detection message
                        displayMessage(`${existingWarning}<br><br>${assemblyMessage}`, 'warning');
                    } else {
                        displayMessage(assemblyMessage, 'info');
                    }
                    logMessage(`Reference assembly detected as ${detectedAssembly}.`, 'info');
                } else if (!detectedAssembly && regionSelect.value === 'guess') {
                    displayMessage(
                        'Could not automatically detect the reference assembly. Please select it manually.',
                        'error'
                    );
                    logMessage('Automatic assembly detection failed. Prompting user to select manually.', 'warning');
                    regionSelect.value = ''; // Reset selection
                    hideSpinner();
                    clearCountdown();
                    return;
                }

                // Provide download links for the subsetted BAM and BAI files
                const createdUrls = [];
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
                    linkContainer.classList.add('download-container', 'mb-2'); // Ensure 'mb-2' is defined in your CSS or remove if unnecessary
                    linkContainer.appendChild(downloadBamLink);
                    linkContainer.appendChild(downloadBaiLink);

                    // Append the container to the regionOutput div
                    regionOutputDiv.appendChild(linkContainer);

                    // Create and append the horizontal divider after the container
                    const divider = document.createElement('hr');
                    divider.classList.add('separator'); // Applies the styles from buttons.css
                    regionOutputDiv.appendChild(divider);

                    logMessage(`Download links provided for ${subsetName} and ${subsetBaiName}.`, 'info');
                });
            }

            // Revoke blob URLs after user has had time to download (5 minutes)
            // blobManager will also auto-cleanup old URLs periodically
            setTimeout(() => {
                const revokedCount = blobManager.revokeMultiple(createdUrls);
                logMessage(`Revoked ${revokedCount} Blob URLs from region extraction`, 'info');
            }, 300000); // 5 minutes

            hideSpinner(); // Hide spinner after extraction is complete
            clearCountdown();
            logMessage('Region extraction completed.', 'info');
        } catch (err) {
            displayError(`Error: ${err.message}`);
            logMessage(`Error during region extraction: ${err.message}`, 'error');
            hideSpinner(); // Hide spinner on error
            clearCountdown();
        }
    });

    /**
     * Handle keyboard activation for the drop area
     */
    const dropArea = document.getElementById('dropArea');
    const bamFilesInput = document.getElementById('bamFiles');

    dropArea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            bamFilesInput.click();
            logMessage('File upload dialog triggered via keyboard.', 'info');
        }
    });

    // ***********************************************************************
    // NEW: Modify file input change handler to reset application state on new file selection
    // ***********************************************************************
    bamFilesInput.addEventListener('change', (event) => {
        resetApplicationState();
        selectedFiles = Array.from(event.target.files);
        displaySelectedFiles(selectedFiles);
        logMessage(`${selectedFiles.length} file(s) selected for upload.`, 'info');
    });
    // ***********************************************************************

        // Check URL for job_id or cohort_id on initial load
        checkURLParameters();
    } catch (error) {
        // Handle critical initialization errors
        errorHandler.handleError(error, {
            phase: 'initialization',
            function: 'initializeApp'
        }, ErrorLevel.CRITICAL);

        // Show user-friendly error
        displayError('Failed to initialize application. Please refresh the page.');
        console.error('[App] Critical initialization error:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
