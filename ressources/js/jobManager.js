// frontend/resources/js/jobManager.js

import { getJobStatus, pollJobStatusAPI } from './apiInteractions.js';
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
 * Utilizes the getJobStatus function from apiInteractions.js.
 * @param {string} jobId - The job identifier.
 * @param {object} context - An object containing necessary DOM elements and state.
 */
export async function fetchAndUpdateJobStatus(jobId, context) {
    const {
        jobInfoDiv,
        jobStatusDiv,
        jobQueuePositionDiv,
        displayedCohorts,
        cohortsContainer,
        serverLoad
    } = context;

    try {
        const data = await getJobStatus(jobId);

        if (data.cohort_id && !displayedCohorts.has(data.cohort_id)) {
            // Create a new cohort section
            const cohortSection = document.createElement('div');
            cohortSection.id = `cohort-${data.cohort_id}`;
            cohortSection.classList.add('cohort-section');

            const cohortInfo = document.createElement('div');
            cohortInfo.classList.add('cohort-info');
            cohortInfo.innerHTML = `Cohort ID: <strong>${data.cohort_id}</strong>`;

            cohortSection.appendChild(cohortInfo);
            cohortsContainer.appendChild(cohortSection);

            // Add to displayed cohorts
            displayedCohorts.add(data.cohort_id);
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
            displayDownloadLink(jobId, context);
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
            logMessage(`Job ID ${jobId} is currently ${data.status}.`, 'info');
        }
    } catch (error) {
        logMessage(`Error fetching job status for Job ID ${jobId}: ${error.message}`, 'error');
        hideSpinner();
        clearCountdown();
    }
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
        serverLoad
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

        // Immediately fetch and update job status
        await fetchAndUpdateJobStatus(jobId, context);

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
                displayDownloadLink(jobId, context);
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
