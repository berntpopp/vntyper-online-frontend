// frontend/ressources/js/jobManager.js

import { getCohortStatus, pollJobStatusAPI } from './apiInteractions.js';
import { displayError, clearError } from './errorHandling.js';
import { hideSpinner, clearCountdown, displayShareableLink, hidePlaceholderMessage } from './uiUtils.js';
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
 * Displays the download link once the job is completed.
 * @param {string} jobId - The job identifier.
 * @param {object} context - An object containing necessary DOM elements and state.
 */
export function displayDownloadLink(jobId, context) {
    const { hidePlaceholderMessage, jobStatusDiv, logMessage } = context;

    hidePlaceholderMessage(); // Now correctly imported

    const downloadLink = document.createElement('a');
    downloadLink.href = `${window.CONFIG.API_URL}/download/${jobId}/`;
    downloadLink.textContent = 'Download vntyper results';
    downloadLink.classList.add('download-link', 'download-button');
    downloadLink.target = '_blank'; // Open in a new tab
    downloadLink.setAttribute('aria-label', `Download results for Job ID ${jobId}`);

    jobStatusDiv.appendChild(document.createElement('br'));
    jobStatusDiv.appendChild(downloadLink);
    logMessage(`Download link generated for Job ID ${jobId}.`, 'info');
}

/**
 * Fetches the current job status and updates the UI immediately.
 * Utilizes the getCohortStatus function from apiInteractions.js.
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
        serverLoad
    } = context;

    try {
        const data = await getCohortStatus(cohortId);

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

    jobs.forEach(job => {
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
                logMessage
            });
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
        cohortsContainer
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
        displayShareableLink(jobId);

        // Create a status element for this job
        const statusElement = document.createElement('div');
        statusElement.id = `status-${jobId}`;
        statusElement.innerHTML = `Status: <strong>Loading...</strong>`;
        statusElement.classList.add('job-status');
        jobStatusDiv.appendChild(statusElement);

        // Start polling job status every 20 seconds
        pollJobStatusAPI(
            jobId,
            async () => {
                // Fetch the job status
                const jobStatus = await getCohortStatus(jobId); // Assuming jobId is also cohortId for single jobs
                updateCohortUI(jobStatus, context);
            },
            () => {
                // On Complete
                displayDownloadLink(jobId, {
                    hidePlaceholderMessage,
                    jobStatusDiv: statusElement,
                    logMessage
                });
                hideSpinner();
                clearCountdown();
                logMessage(`Job ID ${jobId} has been completed.`, 'success');
                serverLoad.updateServerLoad();
            },
            (errorMessage) => {
                // On Error
                displayError(errorMessage);
                logMessage(`Job ID ${jobId} encountered an error: ${errorMessage}`, 'error');
                hideSpinner();
                clearCountdown();
                serverLoad.updateServerLoad();
            }
        );

        hideSpinner();
    } catch (error) {
        logMessage(`Error loading Job ID ${jobId}: ${error.message}`, 'error');
        hideSpinner();
    }
}
