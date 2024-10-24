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
 */
export function pollJobStatusAPI(jobId, onStatusUpdate, onComplete, onError) {
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`${window.CONFIG.API_URL}/job-status/${jobId}/`);
            if (!response.ok) {
                throw new Error('Failed to fetch job status.');
            }
            const data = await response.json();
            onStatusUpdate(data.status);
            if (data.status === 'completed') {
                clearInterval(interval);
                onComplete();
            } else if (data.status === 'failed') {
                clearInterval(interval);
                onError(data.error || 'Job failed.');
            }
        } catch (error) {
            clearInterval(interval);
            onError(error.message);
        }
    }, 5000); // Poll every 5 seconds
}
