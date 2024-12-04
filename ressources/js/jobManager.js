// frontend/resources/js/jobManager.js

import { getCohortStatus, pollJobStatusAPI, getJobStatus, pollCohortStatusAPI } from './apiInteractions.js';
import { displayError, clearError } from './errorHandling.js';
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
 * Updates the UI based on the current job status.
 * @param {Object} jobStatus - The job status object returned from the API.
 * @param {Object} context - An object containing necessary DOM elements and state.
 */
function updateJobUI(jobStatus, context) {
    const { job_id, status, error } = jobStatus;
    const jobStatusDiv = document.getElementById(`status-${job_id}`);
    if (!jobStatusDiv) return;

    // Update job status
    jobStatusDiv.innerHTML = `Status: <strong>${capitalizeFirstLetter(status)}</strong>`;

    if (status === 'failed') {
        const errorMessage = error || 'Job failed.';
        displayError(errorMessage);
        logMessage(`Job ID ${job_id} failed with error: ${errorMessage}`, 'error');
    }

    logMessage(`Job ID ${job_id} status updated to: ${status}`, 'info');
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
        jobStatusDiv,
        jobQueuePositionDiv,
        regionOutputDiv,
        displayShareableLink,
        pollCohortStatusAPI,
        fetchAndUpdateJobStatus,
        resetCountdown,
        logMessage,
        serverLoad,
        displayedCohorts,
        cohortsContainer,
        passphraseInput, // Added to context
    } = context;

    try {
        showSpinner();
        clearError();
        clearMessage();
        jobInfoDiv.innerHTML = '';
        jobStatusDiv.innerHTML = '';
        jobQueuePositionDiv.innerHTML = '';
        regionOutputDiv.innerHTML = '';

        // Retrieve passphrase from the passphrase input field
        const passphrase = passphraseInput.value.trim() || null;

        // Display initial cohort information
        const cohortInfo = document.createElement('div');
        cohortInfo.innerHTML = `Loading cohort details for Cohort ID: <strong>${cohortId}</strong>`;
        jobInfoDiv.appendChild(cohortInfo);
        logMessage(`Loading details for Cohort ID ${cohortId}.`, 'info');

        // Generate and display the shareable link for the cohort
        displayShareableLink(cohortId, jobInfoDiv); // Assuming cohortId can be used similarly to jobId

        // Create a status element for the cohort
        const statusElement = document.createElement('div');
        statusElement.id = `status-${cohortId}`;
        statusElement.innerHTML = `Status: <strong>Loading...</strong>`;
        statusElement.classList.add('job-status');
        jobStatusDiv.appendChild(statusElement);

        // Start polling cohort status with passphrase
        pollCohortStatusAPI(
            cohortId,
            async () => {
                const cohortStatus = await getCohortStatus(cohortId, passphrase);
                fetchAndUpdateJobStatus(cohortId, context); // Update cohort UI
            },
            () => {
                // On Complete
                hideSpinner();
                clearCountdown();
                logMessage(`Cohort ID ${cohortId} has been completed.`, 'success');
                serverLoad.updateServerLoad();
            },
            (errorMessage) => {
                // On Error
                displayError(errorMessage);
                logMessage(`Cohort ID ${cohortId} encountered an error: ${errorMessage}`, 'error');
                hideSpinner();
                clearCountdown();
                serverLoad.updateServerLoad();
            },
            null,
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
 * Fetches the current cohort status and updates the UI immediately.
 * Utilizes the getCohortStatus function.
 * @param {string} cohortId - The cohort identifier.
 * @param {object} context - An object containing necessary DOM elements and state.
 */
export async function fetchAndUpdateJobStatus(cohortId, context) {
    const {
        jobInfoDiv,
        jobStatusDiv,
        jobQueuePositionDiv,
        displayedCohorts,
        cohortsContainer,
        serverLoad,
        passphraseInput, // Added to context
    } = context;

    try {
        const passphrase = passphraseInput.value.trim() || null;
        const data = await getCohortStatus(cohortId, passphrase);

        if (data.cohort_id && !displayedCohorts.has(data.cohort_id)) {
            // Create a new cohort section if not already displayed
            const cohortSection = document.createElement('div');
            cohortSection.id = `cohort-${data.cohort_id}`;
            cohortSection.classList.add('cohort-section');

            const cohortInfo = document.createElement('div');
            cohortInfo.classList.add('cohort-info');
            cohortInfo.innerHTML = `Cohort Alias: <strong>${data.alias}</strong> | Cohort ID: <strong>${data.cohort_id}</strong>`;

            const jobsContainer = document.createElement('div');
            jobsContainer.id = `jobs-container-${data.cohort_id}`;
            jobsContainer.classList.add('jobs-container');

            cohortSection.appendChild(cohortInfo);
            cohortSection.appendChild(jobsContainer);
            cohortsContainer.appendChild(cohortSection);

            // Add to displayed cohorts
            displayedCohorts.add(data.cohort_id);
            logMessage(`Cohort ${data.cohort_id} displayed in UI.`, 'info');
        }

        // Update the cohort UI with current job statuses
        updateCohortUI(data, context);
    } catch (error) {
        logMessage(`Error fetching cohort status for Cohort ID ${cohortId}: ${error.message}`, 'error');
        hideSpinner();
        clearCountdown();
    }
}

/**
 * Updates the UI based on the current cohort status.
 * @param {Object} cohortStatus - The cohort status object returned from the API.
 * @param {Object} context - An object containing necessary DOM elements and state.
 */
function updateCohortUI(cohortStatus, context) {
    const { cohort_id, alias, jobs } = cohortStatus;
    const cohortSection = document.getElementById(`cohort-${cohort_id}`);
    if (!cohortSection) return;

    const jobsContainer = document.getElementById(`jobs-container-${cohort_id}`);
    if (!jobsContainer) return;

    // Clear existing job statuses
    jobsContainer.innerHTML = '';

    jobs.forEach((job) => {
        const { job_id, status, error } = job;

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

        if (status === 'completed') {
            displayDownloadLink(job_id, {
                hidePlaceholderMessage,
                jobStatusDiv: jobStatus,
                logMessage: context.logMessage,
                clearCountdown, // Ensure clearCountdown is passed
            });
            // Generate and display shareable link
            displayShareableLink(job_id, jobsContainer); // Pass jobsContainer as targetContainer
        } else if (status === 'failed') {
            const errorMessage = error || 'Job failed.';
            displayError(errorMessage);
            logMessage(`Job ID ${job_id} failed with error: ${errorMessage}`, 'error');
        }
    });

    logMessage(`Cohort ID ${cohort_id} status updated.`, 'info');
}

/**
 * Fetches and displays job details based on the job ID.
 * Utilizes pollJobStatusAPI to retrieve job status and details.
 * Performs an immediate poll and then continues polling at intervals.
 * @param {string} jobId - The job identifier.
 * @param {object} context - An object containing necessary DOM elements and state.
 */
export async function loadJobFromURL(jobId, context) {
    const {
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
        cohortsContainer,
        passphraseInput, // Added to context
    } = context;

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
        displayShareableLink(jobId, jobInfoDiv); // Pass jobInfoDiv as targetContainer

        // Create a status element for this job
        const statusElement = document.createElement('div');
        statusElement.id = `status-${jobId}`;
        statusElement.innerHTML = `Status: <strong>Loading...</strong>`;
        statusElement.classList.add('job-status');
        jobStatusDiv.appendChild(statusElement);

        // Start polling job status
        pollJobStatusAPI(
            jobId,
            () => {
                displayDownloadLink(jobId, {
                    hidePlaceholderMessage,
                    jobStatusDiv: jobStatus,
                    logMessage,
                });
            },
            (errorMessage) => {
                displayError(errorMessage);
                logMessage(`Job ID ${jobId} failed: ${errorMessage}`, 'error');
                hideSpinner(); // Hide spinner when individual job fails
                clearCountdown();
            }
        );

        hideSpinner();
        clearCountdown();
    } catch (error) {
        logMessage(`Error loading Job ID ${jobId}: ${error.message}`, 'error');
        hideSpinner();
        clearCountdown();
    }
}
