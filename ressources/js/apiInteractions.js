// frontend/ressources/js/apiInteractions.js

/**
 * Submits a job to the backend API.
 * @param {FormData} formData - The form data containing job parameters and files.
 * @returns {Promise<Object>} - The JSON response from the API.
 * @throws {Error} - If the submission fails.
 */
export async function submitJobToAPI(formData) {
    try {
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
                console.error('Error parsing error response:', e);
            }
            throw new Error(errorMessage);
        }

        return response.json();
    } catch (error) {
        console.error('Error in submitJobToAPI:', error);
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
        const response = await fetch(`${window.CONFIG.API_URL}/job-status/${jobId}/`);
        if (!response.ok) {
            throw new Error('Failed to fetch job status.');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error in getJobStatus:', error);
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
    const interval = setInterval(async () => {
        try {
            if (onPoll && typeof onPoll === 'function') {
                onPoll();
            }

            // Use the getJobStatus function to fetch current status
            const data = await getJobStatus(jobId);

            // Update status using the provided callback
            onStatusUpdate(data.status);

            // Optionally, handle additional job details if available
            if (data.details) {
                console.log('Job Details:', data.details);
                // For example, update the UI with additional details here
            }

            if (data.status === 'completed') {
                clearInterval(interval);
                onComplete();
            } else if (data.status === 'failed') {
                clearInterval(interval);
                onError(data.error || 'Job failed.');
            } else {
                // Fetch job queue position if applicable
                if (onQueueUpdate && typeof onQueueUpdate === 'function') {
                    const queueData = await getJobQueueStatus(jobId);
                    onQueueUpdate(queueData);
                }
            }
        } catch (error) {
            clearInterval(interval);
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
        let url = `${window.CONFIG.API_URL}/job-queue/`;
        if (jobId) {
            url += `?job_id=${jobId}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch job queue status.');
        }
        return response.json();
    } catch (error) {
        console.error('Error in getJobQueueStatus:', error);
        throw error;
    }
}

/**
 * Creates a cohort by sending a POST request to the backend API.
 * @param {string} alias - The cohort alias provided by the user.
 * @param {string} email - The user's email for notifications.
 * @returns {Promise<string>} - The created cohort ID.
 * @throws {Error} - If the cohort creation fails.
 */
export async function createCohort(alias, email) {
    try {
        const formData = new FormData();
        if (alias) formData.append('alias', alias);
        if (email) formData.append('email', email);

        const response = await fetch(`${window.CONFIG.API_URL}/create-cohort/`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            let errorMessage = 'Failed to create cohort.';
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
                console.error('Error parsing cohort creation error response:', e);
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log(`Cohort created with ID: ${data.cohort_id}`);
        return data.cohort_id;
    } catch (error) {
        console.error('Error in createCohort:', error);
        throw error;
    }
}
