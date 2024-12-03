// frontend/resources/js/main.js

import { validateFiles } from './inputWrangling.js';
import { submitJobToAPI, createCohort } from './apiInteractions.js';
import { initializeAioli, extractRegionAndIndex } from './bamProcessing.js';
import { initializeModal } from './modal.js';
import { initializeFooter } from './footer.js';
import { initializeDisclaimer } from './disclaimer.js';
import { initializeFAQ } from './faq.js';
import { initializeUserGuide } from './userGuide.js';
import { initializeCitations } from './citations.js';
import { initializeTutorial } from './tutorial.js';
import { regions } from './regionsConfig.js';
import { displayError, clearError } from './errorHandling.js';
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
    showPlaceholderMessage
} from './uiUtils.js';
import { initializeFileSelection } from './fileSelection.js';
import { initializeServerLoad } from './serverLoad.js';
import { logMessage, initializeLogging } from './log.js';
import { fetchAndUpdateJobStatus, loadJobFromURL, displayDownloadLink } from './jobManager.js'; // Updated import

/**
 * Initializes the application by setting up event listeners and dynamic content.
 */
async function initializeApp() {
    // Initialize modal and footer functionalities
    initializeModal();
    initializeFooter(); // Initialize the actual footer
    initializeDisclaimer(); // Initialize the disclaimer functionality

    // Initialize other sections
    initializeFAQ();
    initializeUserGuide();
    initializeCitations();
    initializeTutorial();

    // Initialize UI Utilities (includes toggle functionality)
    initializeUIUtils();

    // Initialize Logging System
    initializeLogging();
    logMessage('Application initialized.', 'info');

    // Get references to DOM elements
    const submitBtn = document.getElementById('submitBtn');
    const extractBtn = document.getElementById('extractBtn');
    const jobInfoDiv = document.getElementById('jobInfo');
    const jobStatusDiv = document.getElementById('jobStatus');
    const jobQueuePositionDiv = document.getElementById('jobQueuePosition');
    const regionSelect = document.getElementById('region');
    const regionOutputDiv = document.getElementById('regionOutput');
    const emailInput = document.getElementById('email');
    const cohortAliasInput = document.getElementById('cohortAlias');
    const passphraseInput = document.getElementById('passphrase'); // **Added**

    // Initialize file selection
    let selectedFiles = [];
    const fileSelection = initializeFileSelection(selectedFiles);
    const { displaySelectedFiles } = fileSelection;

    // Initialize server load monitoring
    const serverLoad = initializeServerLoad();

    const cohortsContainer = document.createElement('div');
    cohortsContainer.id = 'cohortsContainer';
    jobInfoDiv.appendChild(cohortsContainer);

    const displayedCohorts = new Set();

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
     * Checks URL parameters for job_id and loads the job if present.
     */
    function checkURLForJob() {
        const urlParams = new URLSearchParams(window.location.search);
        const jobId = urlParams.get('job_id');
        if (jobId) {
            loadJobFromURL(jobId, {
                showSpinner,
                hideSpinner,
                clearError,
                clearMessage,
                jobInfoDiv,
                jobStatusDiv,
                jobQueuePositionDiv,
                regionOutputDiv,
                displayShareableLink,
                pollJobStatusAPI,
                fetchAndUpdateJobStatus,
                resetCountdown,
                logMessage,
                serverLoad,
                displayedCohorts,
                cohortsContainer
            });
        }
    }

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
            // Clear previous outputs and errors
            jobInfoDiv.innerHTML = '';
            jobStatusDiv.innerHTML = '';
            jobQueuePositionDiv.innerHTML = '';
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
                displayError(`Some files were invalid and not added: ${invalidFiles.map(f => f.name).join(', ')}`);
                logMessage('Invalid files detected during submission.', 'warning');
            }

            if (matchedPairs.length === 0) {
                displayError('No valid BAM and BAI file pairs found for submission.');
                logMessage('No valid file pairs found for submission.', 'warning');
                hideSpinner();
                clearCountdown();
                return;
            }

            // Capture email, cohort alias, and passphrase inputs
            const email = emailInput.value.trim() || null;
            const cohortAlias = cohortAliasInput.value.trim() || null;
            const passphrase = passphraseInput.value.trim() || null; // **Captured Passphrase**

            let cohortId = null;
            let cohortSection = null; // **Reference to the current cohort section**

            // Determine if batch submission is needed and cohort creation is desired
            if (matchedPairs.length > 1) {
                // **Batch Submission: Cohort Creation Optional**
                if (cohortAlias) {
                    // Cohort Alias provided, attempt to create cohort
                    // Passphrase is optional
                    try {
                        const cohortData = await createCohort(cohortAlias, passphrase); // Pass alias and passphrase
                        cohortId = cohortData.cohort_id; // Retrieve cohort_id from response
                        logMessage(`Cohort created with ID: ${cohortId}`, 'info');

                        cohortSection = document.createElement('div');
                        cohortSection.id = `cohort-${cohortId}`;
                        cohortSection.classList.add('cohort-section');

                        const cohortInfo = document.createElement('div');
                        cohortInfo.classList.add('cohort-info');
                        cohortInfo.innerHTML = `Cohort ID: <strong>${cohortId}</strong>`;

                        cohortSection.appendChild(cohortInfo);
                        cohortsContainer.appendChild(cohortSection);
                        logMessage(`Cohort section created for Cohort ID: ${cohortId}`, 'info');
                    } catch (cohortError) {
                        // Handle cohort creation error
                        displayError(`Cohort Creation Failed: ${cohortError.message}`);
                        logMessage(`Cohort creation failed: ${cohortError.message}`, 'error');
                        hideSpinner();
                        clearCountdown();
                        return;
                    }
                } else {
                    logMessage('Cohort Alias not provided. Proceeding without cohort creation.', 'info');
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
                    const data = await submitJobToAPI(formData);
                    logMessage(`Job submitted successfully! Job ID: ${data.job_id}`, 'success');

                    jobIds.push(data.job_id);

                    // **Create job information element**
                    const jobInfo = document.createElement('div');
                    jobInfo.innerHTML = `Job submitted successfully!<br>Job ID: <strong>${data.job_id}</strong>`;
                    jobInfo.classList.add('job-info');

                    if (cohortSection) {
                        cohortSection.appendChild(jobInfo);
                    } else {
                        jobInfoDiv.appendChild(jobInfo);
                    }

                    // Generate and display shareable link
                    displayShareableLink(data.job_id);

                    // Create a status element for this job
                    const statusElement = document.createElement('div');
                    statusElement.id = `status-${data.job_id}`;
                    statusElement.innerHTML = `Status: <strong>Submitted</strong>`;
                    statusElement.classList.add('job-status');

                    if (cohortId) {
                        // Assuming all jobs share the same cohort section
                        jobStatusDiv.appendChild(statusElement);
                    } else {
                        jobStatusDiv.appendChild(statusElement);
                    }

                    // Immediately fetch and update job status
                    await fetchAndUpdateJobStatus(data.job_id, {
                        jobInfoDiv,
                        jobStatusDiv,
                        jobQueuePositionDiv,
                        displayedCohorts,
                        cohortsContainer,
                        serverLoad,
                        hideSpinner,
                        clearCountdown,
                        displayDownloadLink,
                        logMessage,
                        displayError
                    });

                    // Start polling job status every 20 seconds
                    pollJobStatusAPI(
                        data.job_id,
                        (status) => {
                            // Update status in the jobStatusDiv
                            if (statusElement) {
                                statusElement.innerHTML = `Status: <strong>${capitalizeFirstLetter(status)}</strong>`;
                            }
                            logMessage(`Status updated to: ${status} for Job ID ${data.job_id}.`, 'info');
                        },
                        () => {
                            // On Complete
                            displayDownloadLink(data.job_id, {
                                hidePlaceholderMessage,
                                jobStatusDiv,
                                logMessage
                            });
                            hideSpinner();
                            clearCountdown();
                            logMessage(`Spinner and countdown hidden for Job ID ${data.job_id}.`, 'info');
                            jobQueuePositionDiv.innerHTML = '';
                            serverLoad.updateServerLoad();
                        },
                        (errorMessage) => {
                            // On Error
                            displayError(errorMessage);
                            logMessage(`Job ID ${data.job_id} failed with error: ${errorMessage}`, 'error');
                            hideSpinner();
                            clearCountdown();
                            jobQueuePositionDiv.innerHTML = '';
                            serverLoad.updateServerLoad();
                        },
                        () => {
                            // onPoll Callback to reset countdown
                            resetCountdown();
                            logMessage('Countdown reset to 20 seconds.', 'info');
                        },
                        (queueData) => {
                            // onQueueUpdate callback
                            const { position_in_queue, total_jobs_in_queue, status } = queueData;
                            if (position_in_queue) {
                                jobQueuePositionDiv.innerHTML = `Position in Queue: <strong>${position_in_queue}</strong> out of <strong>${total_jobs_in_queue}</strong>`;
                                logMessage(`Job ID ${data.job_id} is position ${position_in_queue} out of ${total_jobs_in_queue} in the queue.`, 'info');
                            } else if (status) {
                                jobQueuePositionDiv.innerHTML = `${status}`;
                                logMessage(`Job ID ${data.job_id} queue status: ${status}.`, 'info');
                            } else {
                                jobQueuePositionDiv.innerHTML = '';
                            }
                            // Update server load indicator
                            serverLoad.updateServerLoad();
                        }
                    );
                } catch (jobError) {
                    // Handle individual job submission error
                    displayError(`Job Submission Failed: ${jobError.message}`);
                    logMessage(`Job submission failed: ${jobError.message}`, 'error');
                    hideSpinner();
                    clearCountdown();
                    return;
                }
            }

            selectedFiles = [];
            displaySelectedFiles();
            logMessage('All selected files have been submitted.', 'info');

        } catch (err) {
            logMessage(`Error during job submission: ${err.message}`, 'error');
            hideSpinner();
            clearCountdown();
            logMessage('Spinner and countdown hidden due to exception.', 'info');
            jobQueuePositionDiv.innerHTML = '';
            serverLoad.updateServerLoad();
        } finally {
            // Reset the button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Job';
            logMessage('Submit button re-enabled and text reset to "Submit Job".', 'info');
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

            const CLI = await initializeAioli();
            const { matchedPairs, invalidFiles } = validateFiles(selectedFiles, false);

            if (invalidFiles.length > 0) {
                displayError(`Some files were invalid and not added: ${invalidFiles.map(f => f.name).join(', ')}`);
                logMessage('Invalid files detected during region extraction.', 'warning');
            }

            if (matchedPairs.length === 0) {
                displayError('No valid BAM and BAI file pairs found for extraction.');
                logMessage('No valid file pairs found for region extraction.', 'warning');
                return;
            }

            // Extract region and detect assembly for each pair
            for (const pair of matchedPairs) {
                const { subsetBamAndBaiBlobs, detectedAssembly, region } = await extractRegionAndIndex(CLI, pair);
                logMessage('Subset BAM and BAI Blobs created during extraction.', 'info');
                logMessage(`Detected Assembly: ${detectedAssembly}`, 'info');
                logMessage(`Region used: ${region}`, 'info');

                // Update the region select dropdown based on detected assembly
                if (detectedAssembly) {
                    regionSelect.value = detectedAssembly;

                    // Display message about the detected assembly
                    displayMessage(
                        `Detected reference assembly: ${detectedAssembly.toUpperCase()}. Please confirm or select manually.`,
                        'info'
                    );
                    logMessage(`Reference assembly detected as ${detectedAssembly}.`, 'info');
                } else {
                    // Prompt the user to select manually
                    displayMessage(
                        'Could not automatically detect the reference assembly. Please select it manually.',
                        'error'
                    );
                    logMessage('Automatic assembly detection failed. Prompting user to select manually.', 'warning');
                    regionSelect.value = ''; // Reset selection
                    return;
                }

                // Provide download links for the subsetted BAM and BAI files
                subsetBamAndBaiBlobs.forEach((subset) => {
                    const { subsetBamBlob, subsetBaiBlob, subsetName } = subset;
                    const subsetBaiName = `${subsetName}.bai`;

                    const downloadBamUrl = URL.createObjectURL(subsetBamBlob);
                    const downloadBaiUrl = URL.createObjectURL(subsetBaiBlob);

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
                    linkContainer.classList.add('download-container', 'mb-2'); /* Ensure 'mb-2' is defined in your CSS or remove if unnecessary */
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

            // Optionally: Revoke the Object URLs after some time to free memory
            setTimeout(() => {
                document.querySelectorAll('#regionOutput a').forEach((link) => {
                    URL.revokeObjectURL(link.href);
                    logMessage(`Object URL revoked for ${link.download}.`, 'info');
                });
            }, 60000); // Revoke after 60 seconds

            logMessage('Region extraction completed.', 'info');
        } catch (err) {
            displayError(`Error: ${err.message}`);
            logMessage(`Error during region extraction: ${err.message}`, 'error');
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

    // Check URL for job_id on initial load
    checkURLForJob();
}

// Initialize the application once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
