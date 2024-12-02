// frontend/ressources/js/apiInteractions.js

import { logMessage } from './log.js'; // Import the logMessage function

/**
 * Submits a job to the backend API.
 * @param {FormData} formData - The form data containing job parameters and files.
 * @returns {Promise<Object>} - The JSON response from the API.
 * @throws {Error} - If the submission fails.
 */
export async function submitJobToAPI(formData) {
    try {
        logMessage('Submitting job to the API...', 'info');

        const response = await fetch(`${window.CONFIG.API_URL}/run-job/`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            let errorMessage = 'Failed to submit job.';
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    // detail might be a string or a list of errors
                    if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map(err => err.msg).join(', ');
                    } else if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    }
                }
            } catch (e) {
                logMessage('Error parsing error response in submitJobToAPI.', 'error');
            }
            logMessage(`Job submission failed: ${errorMessage}`, 'error');
            throw new Error(errorMessage);
        }

        const data = await response.json();
        logMessage(`Job submitted successfully! Job ID: ${data.job_id}`, 'success');
        return data;
    } catch (error) {
        logMessage(`Error in submitJobToAPI: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Fetches the current status of a job from the backend API.
 * @param {string} jobId - The unique identifier of the job.
 * @returns {Promise<Object>} - The JSON response containing job status and details.
 * @throws {Error} - If the request fails.
 */
export async function getJobStatus(jobId) {
    try {
        logMessage(`Fetching status for Job ID: ${jobId}`, 'info');

        const response = await fetch(`${window.CONFIG.API_URL}/job-status/${jobId}/`);
        if (!response.ok) {
            let errorMessage = 'Failed to fetch job status.';
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map(err => err.msg).join(', ');
                    } else if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    }
                }
            } catch (e) {
                logMessage('Error parsing job status error response.', 'error');
            }
            logMessage(`Failed to fetch status for Job ID ${jobId}: ${errorMessage}`, 'error');
            throw new Error(errorMessage);
        }
        const data = await response.json();
        logMessage(`Status fetched for Job ID ${jobId}: ${data.status}`, 'info');
        return data;
    } catch (error) {
        logMessage(`Error in getJobStatus for Job ID ${jobId}: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Polls the job status from the backend API at regular intervals.
 * Utilizes the getJobStatus function to fetch the current status.
 * @param {string} jobId - The unique identifier of the job.
 * @param {Function} onStatusUpdate - Callback function to handle status updates.
 * @param {Function} onComplete - Callback function when the job is completed.
 * @param {Function} onError - Callback function when an error occurs.
 * @param {Function} [onPoll] - Optional callback function when a poll is made.
 * @param {Function} [onQueueUpdate] - Optional callback function to handle queue updates.
 */
export function pollJobStatusAPI(jobId, onStatusUpdate, onComplete, onError, onPoll, onQueueUpdate) {
    logMessage(`Starting to poll status for Job ID: ${jobId}`, 'info');

    const interval = setInterval(async () => {
        try {
            if (onPoll && typeof onPoll === 'function') {
                onPoll();
                logMessage(`Polling initiated for Job ID: ${jobId}`, 'info');
            }

            // Use the getJobStatus function to fetch current status
            const data = await getJobStatus(jobId);

            // Update status using the provided callback
            onStatusUpdate(data.status);
            logMessage(`Job ID ${jobId} status updated to: ${data.status}`, 'info');

            // Optionally, handle additional job details if available
            if (data.details) {
                logMessage(`Job ID ${jobId} details: ${JSON.stringify(data.details)}`, 'info');
                // For example, update the UI with additional details here
            }

            if (data.status === 'completed') {
                clearInterval(interval);
                logMessage(`Job ID ${jobId} has been completed.`, 'success');
                onComplete();
            } else if (data.status === 'failed') {
                clearInterval(interval);
                const errorMsg = data.error || 'Job failed.';
                logMessage(`Job ID ${jobId} failed with error: ${errorMsg}`, 'error');
                onError(errorMsg);
            } else {
                // Job is still processing
                logMessage(`Job ID ${jobId} is in status: ${data.status}`, 'info');

                // Fetch job queue position if applicable
                if (onQueueUpdate && typeof onQueueUpdate === 'function') {
                    try {
                        const queueData = await getJobQueueStatus(jobId);
                        onQueueUpdate(queueData);
                        logMessage(`Queue data updated for Job ID ${jobId}: ${JSON.stringify(queueData)}`, 'info');
                    } catch (queueError) {
                        logMessage(`Error fetching job queue status for Job ID ${jobId}: ${queueError.message}`, 'error');
                        // Optionally, you can decide how to handle queue fetch errors
                    }
                }
            }
        } catch (error) {
            clearInterval(interval);
            logMessage(`Error polling status for Job ID ${jobId}: ${error.message}`, 'error');
            onError(error.message);
        }
    }, 20000); // Poll every 20 seconds
}

/**
 * Fetches the job queue status from the backend API.
 * @param {string} [jobId] - Optional job ID to get position in the queue.
 * @returns {Promise<Object>} - The JSON response from the API.
 * @throws {Error} - If the request fails.
 */
export async function getJobQueueStatus(jobId) {
    try {
        logMessage(`Fetching queue status${jobId ? ` for Job ID: ${jobId}` : ''}`, 'info');

        let url = `${window.CONFIG.API_URL}/job-queue/`;
        if (jobId) {
            url += `?job_id=${encodeURIComponent(jobId)}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            let errorMessage = 'Failed to fetch job queue status.';
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map(err => err.msg).join(', ');
                    } else if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    }
                }
            } catch (e) {
                logMessage('Error parsing job queue status error response.', 'error');
            }
            logMessage(`Failed to fetch queue status${jobId ? ` for Job ID ${jobId}` : ''}: ${errorMessage}`, 'error');
            throw new Error(errorMessage);
        }
        const data = await response.json();
        logMessage(`Queue status fetched${jobId ? ` for Job ID ${jobId}` : ''}: ${JSON.stringify(data)}`, 'info');
        return data;
    } catch (error) {
        logMessage(`Error in getJobQueueStatus${jobId ? ` for Job ID ${jobId}` : ''}: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Creates a cohort by sending a POST request to the backend API.
 * @param {string} [alias] - The cohort alias provided by the user.
 * @param {string} [passphrase] - The passphrase for the cohort (optional).
 * @returns {Promise<Object>} - The created cohort object containing cohort_id and alias.
 * @throws {Error} - If the cohort creation fails.
 */
export async function createCohort(alias, passphrase) {
    try {
        logMessage(`Creating cohort with alias: ${alias}`, 'info');

        // Construct the payload as a URL-encoded string
        const params = new URLSearchParams();
        if (alias) params.append('alias', alias);
        if (passphrase) params.append('passphrase', passphrase);

        const response = await fetch(`${window.CONFIG.API_URL}/create-cohort/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded' // Set the content type to URL-encoded
            },
            body: params.toString() // Convert the parameters to a URL-encoded string
        });

        if (!response.ok) {
            let errorMessage = 'Failed to create cohort.';
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map(err => err.msg).join(', ');
                    } else if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    }
                }
            } catch (e) {
                logMessage('Error parsing cohort creation error response.', 'error');
            }
            logMessage(`Cohort creation failed: ${errorMessage}`, 'error');
            throw new Error(errorMessage);
        }

        const data = await response.json();
        logMessage(`Cohort created successfully! Cohort ID: ${data.cohort_id}`, 'success');
        return data; // Returns an object containing cohort_id and alias
    } catch (error) {
        logMessage(`Error in createCohort: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Fetches the current status of a cohort from the backend API.
 * @param {string} cohortId - The unique identifier of the cohort.
 * @returns {Promise<Object>} - The JSON response containing cohort status and details.
 * @throws {Error} - If the request fails.
 */
export async function getCohortStatus(cohortId) {
    try {
        logMessage(`Fetching status for Cohort ID: ${cohortId}`, 'info');

        const response = await fetch(`${window.CONFIG.API_URL}/cohort-status/${cohortId}/`);
        if (!response.ok) {
            let errorMessage = 'Failed to fetch cohort status.';
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map(err => err.msg).join(', ');
                    } else if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    }
                }
            } catch (e) {
                logMessage('Error parsing cohort status error response.', 'error');
            }
            logMessage(`Failed to fetch status for Cohort ID ${cohortId}: ${errorMessage}`, 'error');
            throw new Error(errorMessage);
        }
        const data = await response.json();
        logMessage(`Status fetched for Cohort ID ${cohortId}: ${data.status}`, 'info');
        return data;
    } catch (error) {
        logMessage(`Error in getCohortStatus for Cohort ID ${cohortId}: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Fetches the list of jobs for a cohort from the backend API.
 * @param {string} cohortId - The unique identifier of the cohort.
 * @returns {Promise<Array>} - The array of jobs in the cohort.
 * @throws {Error} - If the request fails.
 */
export async function getCohortJobs(cohortId) {
    try {
        logMessage(`Fetching jobs for Cohort ID: ${cohortId}`, 'info');

        const response = await fetch(`${window.CONFIG.API_URL}/cohort-jobs/${cohortId}/`);
        if (!response.ok) {
            let errorMessage = 'Failed to fetch cohort jobs.';
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map(err => err.msg).join(', ');
                    } else if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    }
                }
            } catch (e) {
                logMessage('Error parsing cohort jobs error response.', 'error');
            }
            logMessage(`Failed to fetch jobs for Cohort ID ${cohortId}: ${errorMessage}`, 'error');
            throw new Error(errorMessage);
        }
        const data = await response.json();
        logMessage(`Jobs fetched for Cohort ID ${cohortId}: ${data.jobs.length} jobs`, 'info');
        return data.jobs;
    } catch (error) {
        logMessage(`Error in getCohortJobs for Cohort ID ${cohortId}: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Polls the cohort status from the backend API at regular intervals.
 * Utilizes the getCohortStatus and getCohortJobs functions to fetch the current status and job list.
 * @param {string} cohortId - The unique identifier of the cohort.
 * @param {Function} onStatusUpdate - Callback function to handle status updates.
 * @param {Function} onComplete - Callback function when the cohort is completed.
 * @param {Function} onError - Callback function when an error occurs.
 * @param {Function} [onPoll] - Optional callback function when a poll is made.
 */
export function pollCohortStatusAPI(cohortId, onStatusUpdate, onComplete, onError, onPoll) {
    logMessage(`Starting to poll status for Cohort ID: ${cohortId}`, 'info');

    const interval = setInterval(async () => {
        try {
            if (onPoll && typeof onPoll === 'function') {
                onPoll();
                logMessage(`Polling initiated for Cohort ID: ${cohortId}`, 'info');
            }

            // Fetch cohort status
            const cohortStatusData = await getCohortStatus(cohortId);
            onStatusUpdate(cohortStatusData.status);

            // Fetch cohort jobs
            const jobs = await getCohortJobs(cohortId);

            // Update job statuses in the UI
            // Note: The updateCohortJobStatuses function should be implemented in main.js
            // updateCohortJobStatuses(cohortId, jobs);

            // Check if all jobs are completed
            const allCompleted = jobs.every(job => job.status === 'completed');

            if (allCompleted) {
                clearInterval(interval);
                logMessage(`All jobs in Cohort ID ${cohortId} have been completed.`, 'success');
                onComplete();
            }
        } catch (error) {
            clearInterval(interval);
            logMessage(`Error polling status for Cohort ID ${cohortId}: ${error.message}`, 'error');
            onError(error.message);
        }
    }, 20000); // Poll every 20 seconds
}
