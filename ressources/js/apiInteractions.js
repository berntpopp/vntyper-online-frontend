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
 * Polls the job status from the backend API at regular intervals.
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

            const response = await fetch(`${window.CONFIG.API_URL}/job-status/${jobId}/`);
            if (!response.ok) {
                throw new Error('Failed to fetch job status.');
            }
            const data = await response.json();
            onStatusUpdate(data.status);

            // Optionally, display additional job details if available
            if (data.details) {
                // You can handle additional details here
                console.log('Job Details:', data.details);
                // For example, update the UI with additional details
            }

            if (data.status === 'completed') {
                clearInterval(interval);
                onComplete();
            } else if (data.status === 'failed') {
                clearInterval(interval);
                onError(data.error || 'Job failed.');
            } else {
                // Fetch job queue position
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
