// frontend/resources/js/jobManager.js

import { getCohortStatus, getJobStatus, pollCohortStatusAPI, pollJobStatusAPI } from './apiInteractions.js';
import { displayError } from './errorHandling.js';
import { hideSpinner, clearCountdown, displayShareableLink, hidePlaceholderMessage, displayDownloadLink } from './uiUtils.js';
import { logMessage } from './log.js';

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
 * Updates the UI based on the current cohort status.
 * @param {Object} cohortStatus - The cohort status object returned from the API.
 * @param {Object} context - An object containing necessary DOM elements and state.
 */
function updateCohortUI(cohortStatus, context) {
    const { cohort_id, alias, jobs } = cohortStatus;
    const cohortSection = document.getElementById(`cohort-${cohort_id}`);
    if (!cohortSection) {
        logMessage(`Cohort section #cohort-${cohort_id} not found in the DOM.`, 'warning');
        return;
    }

    const jobsContainer = document.getElementById(`jobs-container-${cohort_id}`);
    if (!jobsContainer) {
        logMessage(`Jobs container #jobs-container-${cohort_id} not found in the DOM.`, 'warning');
        return;
    }

    // Clear existing job statuses
    jobsContainer.innerHTML = '';

    let allCompleted = true; // Flag to check if all jobs are completed

    jobs.forEach((job) => {
        const { job_id, status, error } = job;

        if (!job_id || typeof job_id !== 'string' || job_id.trim() === '') {
            logMessage(`Invalid or missing job_id in job: ${JSON.stringify(job)}`, 'error');
            return; // Skip jobs without a valid job_id
        }

        // Create job info element
        const jobInfo = document.createElement('div');
        jobInfo.innerHTML = `Job ID: <strong>${job_id}</strong>`;
        jobInfo.classList.add('job-info');

        // Create job status element
        const jobStatus = document.createElement('div');
        jobStatus.id = `status-${job_id}`;
        jobStatus.innerHTML = `Status: <strong>${capitalizeFirstLetter(status)}</strong>`;
        jobStatus.classList.add('job-status');

        jobsContainer.appendChild(jobInfo);
        jobsContainer.appendChild(jobStatus);

        // Display shareable link with type 'job'
        displayShareableLink(job_id, jobsContainer, 'job');

        if (status === 'completed') {
            // Display download links if job is completed
            displayDownloadLink(job_id, {
                hidePlaceholderMessage,
                jobStatusDiv: jobStatus,
                logMessage: context.logMessage,
                clearCountdown: context.clearCountdown,
            });
        }

        if (status === 'failed') {
            const errorMessage = error || 'Job failed.';
            displayError(errorMessage);
            logMessage(`Job ID ${job_id} failed with error: ${errorMessage}`, 'error');
            allCompleted = false;
        } else if (status !== 'completed') {
            allCompleted = false;
        }
    });

    logMessage(`Cohort ID ${cohort_id} status updated.`, 'info');

    // If all jobs are completed, stop polling
    if (allCompleted) {
        if (context.stopPolling && typeof context.stopPolling === 'function') {
            context.stopPolling();
        } else {
            logMessage('stopPolling function not provided or is not a function in context.', 'warning');
        }
        hideSpinner();
        clearCountdown();
        logMessage(`All jobs in Cohort ID ${cohort_id} have been completed.`, 'success');
    }
}

/**
 * Fetches and displays cohort details based on the cohort ID.
 * Utilizes pollCohortStatusAPI to retrieve cohort status and update UI accordingly.
 * @param {string} cohortId - The cohort identifier.
 * @param {object} context - An object containing necessary DOM elements and state.
 */
export async function loadCohortFromURL(cohortId, context) {
    const {
        showSpinner,
        hideSpinner,
        clearError,
        clearMessage,
        jobInfoDiv,
        regionOutputDiv,
        pollCohortStatusAPI,
        fetchAndUpdateJobStatus,
        resetCountdown,
        logMessage,
        serverLoad,
        displayedCohorts,
        cohortsContainer,
        passphrase,
    } = context;

    // Validate cohortId
    if (!cohortId || typeof cohortId !== 'string' || cohortId.trim() === '') {
        logMessage('Invalid Cohort ID provided to loadCohortFromURL.', 'error');
        displayError('Invalid Cohort ID provided.');
        hideSpinner();
        clearCountdown();
        return;
    }

    logMessage(`Starting to load Cohort ID: ${cohortId}`, 'info');

    try {
        showSpinner();
        clearError();
        clearMessage();
        jobInfoDiv.innerHTML = '';
        regionOutputDiv.innerHTML = '';

        // Display initial cohort information
        const cohortInfo = document.createElement('div');
        cohortInfo.innerHTML = `Loading cohort details for Cohort ID: <strong>${cohortId}</strong>`;
        jobInfoDiv.appendChild(cohortInfo);
        logMessage(`Loading details for Cohort ID ${cohortId}.`, 'info');

        // Create a status element for the cohort and append it to jobInfoDiv
        const statusElement = document.createElement('div');
        statusElement.id = `status-${cohortId}`;
        statusElement.innerHTML = `Status: <strong>Loading...</strong>`;
        statusElement.classList.add('job-status');
        jobInfoDiv.appendChild(statusElement); // Append directly to jobInfoDiv

        // Add to displayed cohorts
        displayedCohorts.add(cohortId);

        // Define a stopPolling function to be passed to pollCohortStatusAPI
        const stopPolling = () => {
            logMessage(`Polling stopped for Cohort ID ${cohortId}.`, 'info');
        };

        // Start polling cohort status with passphrase
        pollCohortStatusAPI(
            cohortId,
            async () => {
                const cohortStatus = await getCohortStatus(cohortId, passphrase);
                fetchAndUpdateJobStatus(cohortId, cohortStatus, {
                    hidePlaceholderMessage,
                    logMessage,
                    clearCountdown,
                    stopPolling,
                    passphrase, // Passphrase added here
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
                serverLoad.updateServerLoad(cohortId); // Pass cohortId here
                displayedCohorts.delete(cohortId); // Clean up after error
            },
            null, // No onPoll callback needed
            passphrase // Passphrase passed to pollCohortStatusAPI
        );

        hideSpinner();
    } catch (error) {
        logMessage(`Error loading Cohort ID ${cohortId}: ${error.message}`, 'error');
        hideSpinner();
        clearCountdown();
    }
}

/**
 * Fetches and updates job status within a cohort.
 * @param {string} cohortId - The cohort identifier.
 * @param {Object} cohortStatus - The current status of the cohort.
 * @param {Object} context - An object containing necessary DOM elements and state.
 */
export async function fetchAndUpdateJobStatus(cohortId, cohortStatus, context) {
    const {
        hidePlaceholderMessage,
        logMessage,
        clearCountdown,
        stopPolling,
        passphrase,
        displayedCohorts,
    } = context;

    try {
        if (cohortStatus.cohort_id && !displayedCohorts.has(cohortStatus.cohort_id)) {
            // Create a new cohort section if not already displayed
            const cohortSection = document.createElement('div');
            cohortSection.id = `cohort-${cohortStatus.cohort_id}`;
            cohortSection.classList.add('cohort-section');

            const cohortInfo = document.createElement('div');
            cohortInfo.classList.add('cohort-info');
            cohortInfo.innerHTML = `Cohort Alias: <strong>${cohortStatus.alias}</strong> | Cohort ID: <strong>${cohortStatus.cohort_id}</strong>`;

            const jobsContainer = document.createElement('div');
            jobsContainer.id = `jobs-container-${cohortStatus.cohort_id}`;
            jobsContainer.classList.add('jobs-container');

            cohortSection.appendChild(cohortInfo);
            cohortSection.appendChild(jobsContainer);
            document.getElementById('cohortsContainer').appendChild(cohortSection);

            // Add to displayed cohorts
            displayedCohorts.add(cohortStatus.cohort_id);
            logMessage(`Cohort ${cohortStatus.cohort_id} displayed in UI.`, 'info');
        }

        // Update the cohort UI with current job statuses
        updateCohortUI(cohortStatus, context);
    } catch (error) {
        logMessage(`Error fetching cohort status for Cohort ID ${cohortId}: ${error.message}`, 'error');
        hideSpinner();
        clearCountdown();
    }
}

/**
 * Fetches and displays job details based on the job ID.
 * Utilizes pollJobStatusAPI to retrieve job status and details.
 * @param {string} jobId - The job identifier.
 * @param {object} context - An object containing necessary DOM elements and state.
 */
export async function loadJobFromURL(jobId, context) {
    const {
        showSpinner,
        hideSpinner,
        clearError,
        clearMessage,
        jobInfoDiv,           // Container to display job information
        regionOutputDiv,
        displayShareableLink,
        pollJobStatusAPI,
        fetchAndUpdateJobStatus,
        resetCountdown,
        logMessage,
        serverLoad,
        displayedCohorts,
        cohortsContainer,
        passphrase,
    } = context;

    // Validate jobId
    if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
        logMessage('Invalid Job ID provided to loadJobFromURL.', 'error');
        displayError('Invalid Job ID provided.');
        hideSpinner();
        clearCountdown();
        return;
    }

    logMessage(`Starting to load Job ID: ${jobId}`, 'info');

    try {
        showSpinner();
        clearError();
        clearMessage();
        jobInfoDiv.innerHTML = '';
        regionOutputDiv.innerHTML = '';

        // Display initial job information
        const jobInfo = document.createElement('div');
        jobInfo.innerHTML = `Loading job details for Job ID: <strong>${jobId}</strong>`;
        jobInfoDiv.appendChild(jobInfo);
        logMessage(`Loading details for Job ID ${jobId}.`, 'info');

        // Generate and display the shareable link with type 'job'
        displayShareableLink(jobId, jobInfoDiv, 'job'); // Explicitly specify 'job' type

        // Create a status element for this job and append it to jobInfoDiv
        const statusElement = document.createElement('div');
        statusElement.id = `status-${jobId}`;
        statusElement.innerHTML = `Status: <strong>Loading...</strong>`;
        statusElement.classList.add('job-status');
        jobInfoDiv.appendChild(statusElement); // Append directly to jobInfoDiv

        // Start polling job status
        pollJobStatusAPI(
            jobId,
            async (status) => {
                // Update job status in the UI
                const jobStatusDivElement = document.getElementById(`status-${jobId}`);
                if (jobStatusDivElement) {
                    jobStatusDivElement.innerHTML = `Status: <strong>${capitalizeFirstLetter(status)}</strong>`;
                }

                // Display Download and Copy Buttons When Job is Completed
                if (status === 'completed') {
                    displayDownloadLink(jobId, {
                        hidePlaceholderMessage,
                        jobStatusDiv: jobStatusDivElement,
                        logMessage,
                        clearCountdown,
                    });
                    // Shareable link already displayed above
                } else if (status === 'failed') {
                    const errorMessage = 'Job failed.'; // Customize as needed
                    displayError(errorMessage);
                    logMessage(`Job ID ${jobId} failed with error: ${errorMessage}`, 'error');
                } else {
                    // For statuses like 'submitted', 'running', etc.
                    logMessage(`Job ID ${jobId} is currently ${status}.`, 'info');
                }
            },
            () => {
                // On Complete
                hideSpinner();
                clearCountdown();
                logMessage(`Job ID ${jobId} polling completed.`, 'success');
                serverLoad.updateServerLoad(jobId); // Pass jobId here
            },
            (errorMessage) => {
                // On Error
                displayError(errorMessage);
                logMessage(`Job ID ${jobId} encountered an error: ${errorMessage}`, 'error');
                hideSpinner(); // Hide spinner when individual job fails
                clearCountdown();
                serverLoad.updateServerLoad(jobId); // Pass jobId here
            },
            null, // No onPoll callback needed
            null  // No onQueueUpdate callback needed
        );

        hideSpinner();
    } catch (error) {
        logMessage(`Error loading Job ID ${jobId}: ${error.message}`, 'error');
        hideSpinner();
        clearCountdown();
    }
}
