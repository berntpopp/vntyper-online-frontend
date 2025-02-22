// frontend/resources/js/apiInteractions.js

import { logMessage } from './log.js';

/**
 * Set to keep track of active job polling instances.
 */
const activeJobPolls = new Set();

/**
 * Set to keep track of active cohort polling instances.
 */
const activeCohortPolls = new Set();

/**
 * Submits a job or batch of jobs to the backend API.
 * @param {FormData} formData - The form data containing job parameters and files.
 * @param {string|null} [cohortId=null] - Optional cohort ID to associate the jobs with.
 * @param {string|null} [passphrase=null] - Optional passphrase for the cohort.
 * @returns {Promise<Object>} - The JSON response from the API.
 * @throws {Error} - If the submission fails.
 */
export async function submitJobToAPI(formData, cohortId = null, passphrase = null) {
    try {
        logMessage('Submitting job(s) to the API...', 'info');

        // Validate cohortId if provided
        if (cohortId) {
            if (typeof cohortId !== 'string' || cohortId.trim() === '') {
                logMessage('Invalid Cohort ID provided to submitJobToAPI.', 'error');
                throw new Error('Invalid Cohort ID provided.');
            }
            formData.append('cohort_id', cohortId);
            logMessage(`Associating jobs with Cohort ID: ${cohortId}`, 'info');

            // Validate passphrase if provided
            if (passphrase) {
                if (typeof passphrase !== 'string') {
                    logMessage('Passphrase must be a string in submitJobToAPI.', 'error');
                    throw new Error('Passphrase must be a string.');
                }
                formData.append('passphrase', passphrase);
                logMessage('Passphrase included in job submission.', 'info');
            }
        }

        const response = await fetch(`${window.CONFIG.API_URL}/run-job/`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            let errorMessage = 'Failed to submit job(s).';
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    // detail might be a string or a list of errors
                    if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map((err) => err.msg).join(', ');
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
        logMessage(`Job(s) submitted successfully! Job ID(s): ${data.job_id}`, 'success');
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
 * @throws {Error} - If the request fails or jobId is invalid.
 */
export async function getJobStatus(jobId) {
    // Added validation for jobId
    if (typeof jobId !== 'string' || jobId.trim() === '') {
        logMessage('getJobStatus called with invalid Job ID.', 'error');
        throw new Error('Invalid Job ID provided.');
    }

    try {
        logMessage(`Fetching status for Job ID: ${jobId}`, 'info');

        const response = await fetch(`${window.CONFIG.API_URL}/job-status/${encodeURIComponent(jobId)}/`);
        if (!response.ok) {
            let errorMessage = 'Failed to fetch job status.';
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map((err) => err.msg).join(', ');
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
 * Fetches the current status of a cohort from the backend API.
 * @param {string} cohortId - The unique identifier of the cohort.
 * @param {string|null} [passphrase=null] - Optional passphrase for the cohort.
 * @param {string|null} [alias=null] - Optional alias for the cohort. // NEW
 * @returns {Promise<Object>} - The JSON response containing cohort status and job details.
 * @throws {Error} - If the request fails or cohortId is invalid.
 */
export async function getCohortStatus(cohortId, passphrase = null, alias = null) {
    // Added validation for cohortId
    if (typeof cohortId !== 'string' || cohortId.trim() === '') {
        logMessage('getCohortStatus called with invalid Cohort ID.', 'error');
        throw new Error('Invalid Cohort ID provided.');
    }

    try {
        logMessage(`Fetching status for Cohort ID: ${cohortId}`, 'info');

        // Construct URL with passphrase and alias if provided
        let url = `${window.CONFIG.API_URL}/cohort-status/?cohort_id=${encodeURIComponent(cohortId)}`;

        if (passphrase) {
            if (typeof passphrase !== 'string') {
                logMessage('Passphrase must be a string in getCohortStatus.', 'error');
                throw new Error('Passphrase must be a string.');
            }
            url += `&passphrase=${encodeURIComponent(passphrase)}`;
            logMessage('Passphrase included in cohort status request.', 'info');
        }

        // NEW: Append alias if provided
        if (alias) {
            if (typeof alias !== 'string') {
                logMessage('Alias must be a string in getCohortStatus.', 'error');
                throw new Error('Alias must be a string.');
            }
            url += `&alias=${encodeURIComponent(alias)}`;
            logMessage('Alias included in cohort status request.', 'info');
        }
        // END of NEW code

        const response = await fetch(url);
        if (!response.ok) {
            let errorMessage = 'Failed to fetch cohort status.';
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    errorMessage = Array.isArray(errorData.detail)
                        ? errorData.detail.map((err) => err.msg).join(', ')
                        : errorData.detail;
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
 * Polls the job status from the backend API at regular intervals.
 * Utilizes the getJobStatus function to fetch the current status.
 * Implements immediate polling and recursive polling using setTimeout.
 * Prevents duplicate polling for the same Job ID.
 * @param {string} jobId - The unique identifier of the job.
 * @param {Function} onStatusUpdate - Callback function to handle status updates.
 * @param {Function} onComplete - Callback function when the job is completed.
 * @param {Function} onError - Callback function when an error occurs.
 * @param {Function} [onPoll=null] - Optional callback function when a poll is made.
 * @param {Function} [onQueueUpdate=null] - Optional callback function to handle queue updates.
 * @returns {Function} - A function to stop the polling.
 */
export function pollJobStatusAPI(
    jobId,
    onStatusUpdate,
    onComplete,
    onError,
    onPoll = null,
    onQueueUpdate = null
) {
    if (activeJobPolls.has(jobId)) {
        logMessage(`Polling already active for Job ID: ${jobId}`, 'warning');
        return () => {}; // Return a no-op function
    }

    activeJobPolls.add(jobId);
    logMessage(`Starting to poll status for Job ID: ${jobId}`, 'info');

    const POLL_INTERVAL = 5000; // 5 seconds

    let isPolling = true;

    const poll = async () => {
        if (!isPolling) return;

        try {
            if (onPoll && typeof onPoll === 'function') {
                onPoll();
                logMessage(`Polling initiated for Job ID: ${jobId}`, 'info');
            }

            // Fetch current job status
            const data = await getJobStatus(jobId);

            // Update status using the provided callback
            onStatusUpdate(data.status);
            logMessage(`Job ID ${jobId} status updated to: ${data.status}`, 'info');

            // Handle additional job details if available
            if (data.details) {
                logMessage(`Job ID ${jobId} details: ${JSON.stringify(data.details)}`, 'info');
                // For example, update the UI with additional details here
            }

            if (data.status === 'completed') {
                logMessage(`Job ID ${jobId} has been completed.`, 'success');
                onComplete();
                isPolling = false;
                activeJobPolls.delete(jobId);
            } else if (data.status === 'failed') {
                const errorMsg = data.error || 'Job failed.';
                logMessage(`Job ID ${jobId} failed with error: ${errorMsg}`, 'error');
                onError(errorMsg);
                isPolling = false;
                activeJobPolls.delete(jobId);
            } else {
                logMessage(`Job ID ${jobId} is in status: ${data.status}`, 'info');
                // Schedule the next poll
                setTimeout(poll, POLL_INTERVAL);
            }

            // Fetch job queue position if applicable
            if (onQueueUpdate && typeof onQueueUpdate === 'function') {
                try {
                    const queueData = await getJobQueueStatus(jobId);
                    onQueueUpdate(queueData);
                    logMessage(
                        `Queue data updated for Job ID ${jobId}: ${JSON.stringify(queueData)}`,
                        'info'
                    );
                } catch (queueError) {
                    logMessage(
                        `Error fetching job queue status for Job ID ${jobId}: ${queueError.message}`,
                        'error'
                    );
                    // Optionally, decide how to handle queue fetch errors
                }
            }
        } catch (error) {
            logMessage(`Error polling status for Job ID ${jobId}: ${error.message}`, 'error');
            onError(error.message);
            isPolling = false;
            activeJobPolls.delete(jobId);
        }
    };

    // Start polling immediately
    poll();

    // Return a function to stop polling
    return () => {
        isPolling = false;
        activeJobPolls.delete(jobId);
        logMessage(`Polling manually stopped for Job ID ${jobId}.`, 'info');
    };
}

/**
 * Polls the cohort status from the backend API at regular intervals.
 * Utilizes the getCohortStatus function to fetch the current status.
 * Implements immediate polling and recursive polling using setTimeout.
 * Prevents duplicate polling for the same Cohort ID.
 * @param {string} cohortId - The unique identifier of the cohort.
 * @param {Function} onStatusUpdate - Callback function to handle status updates.
 * @param {Function} onComplete - Callback function when the cohort is completed.
 * @param {Function} onError - Callback function when an error occurs.
 * @param {Function} [onPoll=null] - Optional callback function when a poll is made.
 * @param {string|null} [passphrase=null] - Optional passphrase for the cohort.
 * @returns {Function} - A function to stop the polling.
 */
export function pollCohortStatusAPI(
    cohortId,
    onStatusUpdate,
    onComplete,
    onError,
    onPoll = null,
    passphrase = null
) {
    if (activeCohortPolls.has(cohortId)) {
        logMessage(`Polling already active for Cohort ID: ${cohortId}`, 'warning');
        return () => {}; // Return a no-op function
    }

    activeCohortPolls.add(cohortId);
    logMessage(`Starting to poll status for Cohort ID: ${cohortId}`, 'info');

    const POLL_INTERVAL = 5000; // 5 seconds

    let isPolling = true;

    const poll = async () => {
        if (!isPolling) return;

        try {
            if (onPoll && typeof onPoll === 'function') {
                onPoll();
                logMessage(`Polling initiated for Cohort ID: ${cohortId}`, 'info');
            }

            // Fetch current cohort status
            const data = await getCohortStatus(cohortId, passphrase);

            // Update status using the provided callback
            onStatusUpdate(data);

            if (data.jobs && Array.isArray(data.jobs)) {
                const allCompleted = data.jobs.every(job => job.status === 'completed');

                if (allCompleted) {
                    logMessage(`All jobs in Cohort ID ${cohortId} have been completed.`, 'success');
                    onComplete();
                    isPolling = false;
                    activeCohortPolls.delete(cohortId);
                } else if (data.status === 'failed') {
                    const errorMsg = data.error || 'Cohort processing failed.';
                    logMessage(`Cohort ID ${cohortId} failed with error: ${errorMsg}`, 'error');
                    onError(errorMsg);
                    isPolling = false;
                    activeCohortPolls.delete(cohortId);
                } else {
                    logMessage(`Cohort ID ${cohortId} is still processing.`, 'info');
                    // Schedule the next poll
                    setTimeout(poll, POLL_INTERVAL);
                }
            } else {
                logMessage(`Invalid cohort status data for Cohort ID ${cohortId}.`, 'error');
                throw new Error('Invalid cohort status data.');
            }
        } catch (error) {
            logMessage(`Error polling status for Cohort ID ${cohortId}: ${error.message}`, 'error');
            onError(error.message);
            isPolling = false;
            activeCohortPolls.delete(cohortId);
        }
    };

    // Start polling immediately
    poll();

    // Return a function to stop polling
    return () => {
        isPolling = false;
        activeCohortPolls.delete(cohortId);
        logMessage(`Polling manually stopped for Cohort ID ${cohortId}.`, 'info');
    };
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
                        errorMessage = errorData.detail.map((err) => err.msg).join(', ');
                    } else if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    }
                }
            } catch (e) {
                logMessage('Error parsing job queue status error response.', 'error');
            }
            logMessage(
                `Failed to fetch queue status${jobId ? ` for Job ID ${jobId}` : ''}: ${errorMessage}`,
                'error'
            );
            throw new Error(errorMessage);
        }
        const data = await response.json();
        logMessage(
            `Queue status fetched${jobId ? ` for Job ID ${jobId}` : ''}: ${JSON.stringify(data)}`,
            'info'
        );
        return data;
    } catch (error) {
        logMessage(
            `Error in getJobQueueStatus${jobId ? ` for Job ID ${jobId}` : ''}: ${error.message}`,
            'error'
        );
        throw error;
    }
}

/**
 * Creates a cohort by sending a POST request to the backend API.
 * @param {string} alias - The cohort alias provided by the user.
 * @param {string|null} [passphrase=null] - The passphrase for the cohort (optional).
 * @returns {Promise<Object>} - The created cohort object containing cohort_id and alias.
 * @throws {Error} - If the cohort creation fails or input is invalid.
 */
export async function createCohort(alias, passphrase = null) {
    // Added validation for alias
    if (typeof alias !== 'string' || alias.trim() === '') {
        logMessage('createCohort called with invalid alias.', 'error');
        throw new Error('Invalid alias provided.');
    }

    // Optional passphrase validation
    if (passphrase !== null && typeof passphrase !== 'string') {
        logMessage('Passphrase must be a string in createCohort.', 'error');
        throw new Error('Passphrase must be a string.');
    }

    try {
        logMessage(`Creating cohort with alias: ${alias}`, 'info');

        // Construct the payload as a URL-encoded string
        const params = new URLSearchParams();
        params.append('alias', alias);
        if (passphrase) params.append('passphrase', passphrase);

        const response = await fetch(`${window.CONFIG.API_URL}/create-cohort/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded', // Set the content type to URL-encoded
            },
            body: params.toString(), // Convert the parameters to a URL-encoded string
        });

        if (!response.ok) {
            let errorMessage = 'Failed to create cohort.';
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map((err) => err.msg).join(', ');
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
