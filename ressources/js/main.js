// frontend/ressources/js/main.js

import { validateFiles } from './inputWrangling.js';
import {
    submitJobToAPI,
    pollJobStatusAPI,
    pollCohortStatusAPI,
    getJobStatus,
    createCohort,
    getCohortJobs
} from './apiInteractions.js';
import { initializeAioli, extractRegionAndIndex } from './bamProcessing.js';
import { initializeModal, checkAndShowDisclaimer } from './modal.js';
import { initializeFooter } from './footer.js'; // Import from the new footer.js
import { initializeDisclaimer } from './disclaimer.js'; // Import from disclaimer.js
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
    initializeUIUtils
} from './uiUtils.js';
import { initializeFileSelection } from './fileSelection.js';
import { initializeServerLoad } from './serverLoad.js';
import { logMessage, initializeLogging } from './log.js'; // Import logging functions

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

    // Check and show disclaimer modal or indicator based on acknowledgment
    checkAndShowDisclaimer();

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
    const passphraseInput = document.getElementById('passphrase');

    // Initialize file selection
    let selectedFiles = [];
    const fileSelection = initializeFileSelection(selectedFiles);
    const { displaySelectedFiles } = fileSelection;

    // Initialize server load monitoring
    const serverLoad = initializeServerLoad();

    const cohortsContainer = document.createElement('div');
    cohortsContainer.id = 'cohortsContainer';
    jobInfoDiv.appendChild(cohortsContainer);

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
     * Shows the placeholder message in the output area.
     */
    function showPlaceholderMessage() {
        const placeholderMessage = document.getElementById('placeholderMessage');
        if (placeholderMessage) {
            placeholderMessage.classList.remove('hidden');
        }
    }

    /**
     * Hides the placeholder message in the output area.
     */
    function hidePlaceholderMessage() {
        const placeholderMessage = document.getElementById('placeholderMessage');
        if (placeholderMessage) {
            placeholderMessage.classList.add('hidden');
        }
    }

    /**
     * Displays a message to the user in the output area.
     * @param {string} message - The message to display.
     * @param {string} type - The type of message ('info', 'error', 'success').
     */
    function displayMessage(message, type = 'info') {
        hidePlaceholderMessage(); // Hide placeholder when displaying a message
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.innerHTML = message;
            messageDiv.className = ''; // Reset classes
            messageDiv.classList.add('message', `message-${type}`);
            messageDiv.classList.remove('hidden');
        }
    }

    /**
     * Clears the displayed message.
     */
    function clearMessage() {
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.innerHTML = '';
            messageDiv.className = ''; // Reset classes
            messageDiv.classList.add('message', 'hidden');
        }
        showPlaceholderMessage(); // Show placeholder when message is cleared
    }

    /**
     * Generates a shareable URL containing the job ID or cohort ID.
     * @param {string} jobId - The job identifier.
     * @param {string} cohortId - The cohort identifier.
     * @returns {string} - The shareable URL.
     */
    function generateShareableLink(jobId, cohortId = null) {
        const url = new URL(window.location.href);
        if (cohortId) {
            url.searchParams.set('cohort_id', cohortId);
        } else {
            url.searchParams.set('job_id', jobId);
        }
        return url.toString();
    }

    /**
     * Displays the shareable link to the user within the jobInfoDiv.
     * @param {string} jobId - The job identifier.
     * @param {string} cohortId - The cohort identifier.
     */
    function displayShareableLink(jobId, cohortId = null) {
        hidePlaceholderMessage(); // Hide placeholder when displaying shareable link

        const shareContainer = document.createElement('div');
        shareContainer.classList.add('share-container', 'mt-2');

        const shareLabel = document.createElement('span');
        shareLabel.textContent = 'Shareable Link: ';
        shareContainer.appendChild(shareLabel);

        const shareLink = document.createElement('input');
        shareLink.type = 'text';
        shareLink.value = generateShareableLink(jobId, cohortId);
        shareLink.readOnly = true;
        shareLink.classList.add('share-link-input');
        shareLink.setAttribute('aria-label', `Shareable link for ${cohortId ? 'Cohort' : 'Job'} ID ${cohortId || jobId}`);

        // Add copy icon/button
        const copyIcon = document.createElement('button');
        copyIcon.classList.add('copy-button');
        copyIcon.setAttribute('aria-label', 'Copy link');
        copyIcon.innerHTML = '📋'; // Using clipboard emoji as copy icon
        copyIcon.addEventListener('click', () => {
            shareLink.select();
            document.execCommand('copy');
            copyIcon.textContent = '✅'; // Change icon to indicate success
            setTimeout(() => {
                copyIcon.textContent = '📋'; // Revert icon back
            }, 2000);
            logMessage(`Shareable link for ${cohortId ? 'Cohort' : 'Job'} ID ${cohortId || jobId} copied to clipboard.`, 'info');
        });

        shareContainer.appendChild(shareLink);
        shareContainer.appendChild(copyIcon);

        if (cohortId) {
            const cohortSection = document.getElementById(`cohort-${cohortId}`);
            cohortSection.appendChild(shareContainer);
        } else {
            jobInfoDiv.appendChild(shareContainer);
        }
    }

    /**
     * Fetches the current job status and updates the UI immediately.
     * @param {string} jobId - The job identifier.
     */
    async function fetchAndUpdateJobStatus(jobId) {
        try {
            const data = await getJobStatus(jobId);

            if (data.cohort_id && !document.getElementById(`cohort-${data.cohort_id}`)) {
                // Create a new cohort section
                const cohortSection = document.createElement('div');
                cohortSection.id = `cohort-${data.cohort_id}`;
                cohortSection.classList.add('cohort-section');

                const cohortInfo = document.createElement('div');
                cohortInfo.classList.add('cohort-info');
                cohortInfo.innerHTML = `Cohort ID: <strong>${data.cohort_id}</strong>`;

                cohortSection.appendChild(cohortInfo);
                cohortsContainer.appendChild(cohortSection);

                logMessage(`Cohort ${data.cohort_id} displayed in UI.`, 'info');
            }

            // Determine where to append job info
            let targetContainer;
            if (data.cohort_id) {
                targetContainer = document.getElementById(`cohort-${data.cohort_id}`);
            } else {
                targetContainer = jobInfoDiv;
            }

            // Create job information element
            const jobInfo = document.createElement('div');
            jobInfo.innerHTML = `Job ID: <strong>${jobId}</strong> - Status: <strong>${capitalizeFirstLetter(data.status)}</strong>`;
            jobInfo.classList.add('job-info');

            targetContainer.appendChild(jobInfo);

            logMessage(`Status fetched for Job ID ${jobId}: ${data.status}`, 'info');

            if (data.status === 'completed') {
                // On Complete
                displayDownloadLink(jobId);
                hideSpinner();
                clearCountdown();
                jobQueuePositionDiv.innerHTML = '';
                serverLoad.updateServerLoad();
                logMessage(`Job ID ${jobId} completed successfully.`, 'success');
            } else if (data.status === 'failed') {
                // On Error
                const errorMessage = data.error || 'Job failed.';
                displayError(errorMessage);
                logMessage(`Job ID ${jobId} failed with error: ${errorMessage}`, 'error');
                hideSpinner();
                clearCountdown();
                jobQueuePositionDiv.innerHTML = '';
                serverLoad.updateServerLoad();
            } else {
                // Job is still processing
                logMessage(`Job ID ${jobId} is in status: ${data.status}`, 'info');
            }
        } catch (error) {
            logMessage(`Error fetching job status for Job ID ${jobId}: ${error.message}`, 'error');
            hideSpinner();
            clearCountdown();
        }
    }

    /**
     * Fetches and displays job details based on the job ID.
     * @param {string} jobId - The job identifier.
     */
    async function loadJobFromURL(jobId) {
        try {
            showSpinner();
            clearError();
            clearMessage();
            jobInfoDiv.innerHTML = '';
            jobStatusDiv.innerHTML = '';
            jobQueuePositionDiv.innerHTML = '';
            regionOutputDiv.innerHTML = '';

            // Display initial job information
            const jobInfo = document.createElement('div');
            jobInfo.innerHTML = `Loading job details for Job ID: <strong>${jobId}</strong>`;
            jobInfoDiv.appendChild(jobInfo);
            logMessage(`Loading details for Job ID ${jobId}.`, 'info');

            // Generate and display the shareable link
            displayShareableLink(jobId);

            // Create a status element for this job
            const statusElement = document.createElement('div');
            statusElement.id = `status-${jobId}`;
            statusElement.innerHTML = `Status: <strong>Loading...</strong>`;
            statusElement.classList.add('job-status');
            jobStatusDiv.appendChild(statusElement);

            // Immediately fetch and update job status
            await fetchAndUpdateJobStatus(jobId);

            // Start polling job status every 20 seconds
            pollJobStatusAPI(
                jobId,
                (status) => {
                    // Update status in the jobStatusDiv
                    if (statusElement) {
                        statusElement.innerHTML = `Status: <strong>${capitalizeFirstLetter(status)}</strong>`;
                    }
                    logMessage(`Status updated to ${status} for Job ID ${jobId}.`, 'info');
                },
                () => {
                    // On Complete
                    displayDownloadLink(jobId);
                    hideSpinner();
                    clearCountdown();
                    logMessage(`Job ID ${jobId} has been completed.`, 'success');
                    jobQueuePositionDiv.innerHTML = '';
                    serverLoad.updateServerLoad();
                },
                (errorMessage) => {
                    // On Error
                    displayError(errorMessage);
                    logMessage(`Job ID ${jobId} encountered an error: ${errorMessage}`, 'error');
                    hideSpinner();
                    clearCountdown();
                    jobQueuePositionDiv.innerHTML = '';
                    serverLoad.updateServerLoad();
                },
                () => {
                    // onPoll Callback to reset countdown
                    resetCountdown();
                    logMessage(`Countdown reset for polling Job ID ${jobId}.`, 'info');
                },
                (queueData) => {
                    // onQueueUpdate callback
                    const { position_in_queue, total_jobs_in_queue, status } = queueData;
                    if (position_in_queue) {
                        jobQueuePositionDiv.innerHTML = `Position in Queue: <strong>${position_in_queue}</strong> out of <strong>${total_jobs_in_queue}</strong>`;
                        logMessage(`Job ID ${jobId} is position ${position_in_queue} out of ${total_jobs_in_queue} in the queue.`, 'info');
                    } else if (status) {
                        jobQueuePositionDiv.innerHTML = `${status}`;
                        logMessage(`Job ID ${jobId} queue status: ${status}.`, 'info');
                    } else {
                        jobQueuePositionDiv.innerHTML = '';
                    }
                    // Update server load indicator
                    serverLoad.updateServerLoad();
                }
            );

            hideSpinner();
        } catch (error) {
            logMessage(`Error loading Job ID ${jobId}: ${error.message}`, 'error');
            hideSpinner();
        }
    }

    /**
     * Fetches and displays cohort details based on the cohort ID.
     * @param {string} cohortId - The cohort identifier.
     */
    async function loadCohortFromURL(cohortId) {
        try {
            showSpinner();
            clearError();
            clearMessage();
            jobInfoDiv.innerHTML = '';
            jobStatusDiv.innerHTML = '';
            jobQueuePositionDiv.innerHTML = '';
            regionOutputDiv.innerHTML = '';

            // Display cohort header
            const cohortSection = document.createElement('div');
            cohortSection.id = `cohort-${cohortId}`;
            cohortSection.classList.add('cohort-section');

            const cohortInfo = document.createElement('div');
            cohortInfo.classList.add('cohort-info');
            cohortInfo.innerHTML = `Cohort ID: <strong>${cohortId}</strong>`;

            cohortSection.appendChild(cohortInfo);
            jobInfoDiv.appendChild(cohortSection);

            // Generate and display the shareable link
            displayShareableLink(null, cohortId);

            // Start polling cohort status
            pollCohortStatusAPI(
                cohortId,
                (status) => {
                    // Update cohort status in the UI
                    const cohortStatusElement = document.getElementById(`cohort-status-${cohortId}`);
                    if (cohortStatusElement) {
                        cohortStatusElement.innerHTML = `Cohort Status: <strong>${capitalizeFirstLetter(status)}</strong>`;
                    } else {
                        const statusElement = document.createElement('div');
                        statusElement.id = `cohort-status-${cohortId}`;
                        statusElement.innerHTML = `Cohort Status: <strong>${capitalizeFirstLetter(status)}</strong>`;
                        cohortSection.appendChild(statusElement);
                    }
                },
                () => {
                    // On cohort complete
                    hideSpinner();
                    clearCountdown();
                    serverLoad.updateServerLoad();
                    logMessage(`Cohort ID ${cohortId} has completed processing.`, 'success');
                },
                (errorMessage) => {
                    // On Error
                    displayError(`Error with Cohort ID ${cohortId}: ${errorMessage}`);
                    hideSpinner();
                    clearCountdown();
                    serverLoad.updateServerLoad();
                },
                () => {
                    // onPoll Callback to reset countdown
                    resetCountdown();
                }
            );

            hideSpinner();
        } catch (error) {
            logMessage(`Error loading Cohort ID ${cohortId}: ${error.message}`, 'error');
            hideSpinner();
        }
    }

    /**
     * Checks URL parameters for job_id or cohort_id and loads the data if present.
     */
    function checkURLForJobOrCohort() {
        const urlParams = new URLSearchParams(window.location.search);
        const jobId = urlParams.get('job_id');
        const cohortId = urlParams.get('cohort_id');
        if (cohortId) {
            loadCohortFromURL(cohortId);
        } else if (jobId) {
            loadJobFromURL(jobId);
        }
    }

    /**
     * Displays the download link once the job is completed.
     * @param {string} jobId - The job identifier.
     */
    function displayDownloadLink(jobId) {
        hidePlaceholderMessage(); // Hide placeholder when results are available

        const downloadLink = document.createElement('a');
        downloadLink.href = `${window.CONFIG.API_URL}/download/${jobId}/`;
        downloadLink.textContent = 'Download vntyper results';
        downloadLink.classList.add('download-link', 'download-button');
        downloadLink.target = '_blank'; // Open in a new tab
        downloadLink.setAttribute('aria-label', `Download results for Job ID ${jobId}`);

        const statusElement = document.getElementById(`status-${jobId}`);
        if (statusElement) {
            statusElement.appendChild(document.createElement('br'));
            statusElement.appendChild(downloadLink);
        } else {
            jobStatusDiv.appendChild(document.createElement('br'));
            jobStatusDiv.appendChild(downloadLink);
        }

        logMessage(`Download link generated for Job ID ${jobId}.`, 'info');
    }

    /**
     * Updates the job statuses in the UI for a given cohort.
     * @param {string} cohortId - The cohort identifier.
     * @param {Array} jobs - The array of jobs in the cohort.
     */
    function updateCohortJobStatuses(cohortId, jobs) {
        const cohortSection = document.getElementById(`cohort-${cohortId}`);
        if (!cohortSection) return;

        jobs.forEach(job => {
            let jobElement = document.getElementById(`job-${job.job_id}`);
            if (!jobElement) {
                // Create a new job element
                jobElement = document.createElement('div');
                jobElement.id = `job-${job.job_id}`;
                jobElement.classList.add('job-info');

                // Display Job ID and initial status
                jobElement.innerHTML = `
                    Job ID: <strong>${job.job_id}</strong> - Status: <strong>${capitalizeFirstLetter(job.status)}</strong>
                `;

                cohortSection.appendChild(jobElement);
            } else {
                // Update the status
                const statusMatch = jobElement.innerHTML.match(/Status: <strong>(.*?)<\/strong>/);
                if (statusMatch && statusMatch[1] !== capitalizeFirstLetter(job.status)) {
                    jobElement.innerHTML = `
                        Job ID: <strong>${job.job_id}</strong> - Status: <strong>${capitalizeFirstLetter(job.status)}</strong>
                    `;
                }
            }

            // If job is completed and download link not yet added
            if (job.status === 'completed' && !jobElement.querySelector('.download-link')) {
                const downloadLink = document.createElement('a');
                downloadLink.href = `${window.CONFIG.API_URL}/download/${job.job_id}/`;
                downloadLink.textContent = 'Download vntyper results';
                downloadLink.classList.add('download-link', 'download-button');
                downloadLink.target = '_blank';
                downloadLink.setAttribute('aria-label', `Download results for Job ID ${job.job_id}`);

                jobElement.appendChild(document.createElement('br'));
                jobElement.appendChild(downloadLink);
            }
        });
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
            const passphrase = passphraseInput.value.trim() || null;

            let cohortId = null;
            let cohortSection = null;

            // Determine if batch mode is active
            const isBatchMode = matchedPairs.length > 1 || cohortAlias;

            if (isBatchMode) {
                try {
                    // Create cohort with alias and passphrase
                    const cohortData = await createCohort(cohortAlias, passphrase);
                    cohortId = cohortData.cohort_id;
                    logMessage(`Cohort created with ID: ${cohortId}`, 'info');

                    // Create a cohort section in the UI
                    cohortSection = document.createElement('div');
                    cohortSection.id = `cohort-${cohortId}`;
                    cohortSection.classList.add('cohort-section');

                    const cohortInfo = document.createElement('div');
                    cohortInfo.classList.add('cohort-info');
                    cohortInfo.innerHTML = `Cohort ID: <strong>${cohortId}</strong>${cohortAlias ? ` - ${cohortAlias}` : ''}`;

                    cohortSection.appendChild(cohortInfo);
                    cohortsContainer.appendChild(cohortSection);
                    logMessage(`Cohort section created for Cohort ID: ${cohortId}`, 'info');
                } catch (cohortError) {
                    displayError(`Cohort Creation Failed: ${cohortError.message}`);
                    logMessage(`Cohort creation failed: ${cohortError.message}`, 'error');
                    hideSpinner();
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

                // Add email and cohort information if available
                if (email) {
                    formData.append('email', email);
                    logMessage(`Email ${email} added to job submission.`, 'info');
                }
                if (cohortId) {
                    formData.append('cohort_id', cohortId);
                    logMessage(`Cohort ID ${cohortId} added to job submission.`, 'info');
                }
                // Include passphrase in job submission if provided
                if (passphrase) {
                    formData.append('passphrase', passphrase);
                    logMessage(`Passphrase added to job submission.`, 'info');
                }

                // Submit job to API
                try {
                    const data = await submitJobToAPI(formData);
                    logMessage(`Job submitted successfully! Job ID: ${data.job_id}`, 'success');

                    jobIds.push(data.job_id);

                    // Create job information element
                    const jobInfo = document.createElement('div');
                    jobInfo.innerHTML = `Job submitted successfully!<br>Job ID: <strong>${data.job_id}</strong>`;
                    jobInfo.classList.add('job-info');

                    if (cohortSection) {
                        cohortSection.appendChild(jobInfo);
                    } else {
                        jobInfoDiv.appendChild(jobInfo);
                    }

                    // Generate and display shareable link
                    displayShareableLink(data.job_id, cohortId);

                    // Create a status element for this job
                    const statusElement = document.createElement('div');
                    statusElement.id = `status-${data.job_id}`;
                    statusElement.innerHTML = `Status: <strong>Submitted</strong>`;
                    statusElement.classList.add('job-status');

                    if (cohortSection) {
                        cohortSection.appendChild(statusElement);
                    } else {
                        jobStatusDiv.appendChild(statusElement);
                    }

                    // Start polling job status
                    if (!cohortId) {
                        // If not in batch mode, poll each job individually
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
                                displayDownloadLink(data.job_id);
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
                    }
                } catch (jobError) {
                    // Handle individual job submission error
                    displayError(`Job Submission Failed: ${jobError.message}`);
                    logMessage(`Job submission failed: ${jobError.message}`, 'error');
                    hideSpinner();
                    clearCountdown();
                    return;
                }
            }

            // If batch mode is active, start polling the cohort status
            if (cohortId) {
                pollCohortStatusAPI(
                    cohortId,
                    (status) => {
                        // Update cohort status in the UI
                        const cohortStatusElement = document.getElementById(`cohort-status-${cohortId}`);
                        if (cohortStatusElement) {
                            cohortStatusElement.innerHTML = `Cohort Status: <strong>${capitalizeFirstLetter(status)}</strong>`;
                        } else {
                            const statusElement = document.createElement('div');
                            statusElement.id = `cohort-status-${cohortId}`;
                            statusElement.innerHTML = `Cohort Status: <strong>${capitalizeFirstLetter(status)}</strong>`;
                            cohortSection.appendChild(statusElement);
                        }
                    },
                    () => {
                        // On cohort complete
                        hideSpinner();
                        clearCountdown();
                        serverLoad.updateServerLoad();
                        logMessage(`Cohort ID ${cohortId} has completed processing.`, 'success');
                    },
                    (errorMessage) => {
                        // On Error
                        displayError(`Error with Cohort ID ${cohortId}: ${errorMessage}`);
                        hideSpinner();
                        clearCountdown();
                        serverLoad.updateServerLoad();
                    },
                    () => {
                        // onPoll Callback to reset countdown
                        resetCountdown();
                    }
                );
            }

            selectedFiles.length = 0; // Clear selected files
            displaySelectedFiles();
            logMessage('All selected files have been submitted.', 'info');

        } catch (err) {
            logMessage(`Error during job submission: ${err.message}`, 'error');
            hideSpinner();
            clearCountdown();
            jobQueuePositionDiv.innerHTML = '';
            serverLoad.updateServerLoad();
        } finally {
            // Reset the button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Job';
            logMessage('Submit button re-enabled and text reset to "Submit Job".', 'info');
        }
    });

    // Handle keyboard activation for the drop area
    const dropArea = document.getElementById('dropArea');
    const bamFilesInput = document.getElementById('bamFiles');

    dropArea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            bamFilesInput.click();
            logMessage('File upload dialog triggered via keyboard.', 'info');
        }
    });

    // Check URL for job_id or cohort_id on initial load
    checkURLForJobOrCohort();
}

// Initialize the application once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
