// frontend/ressources/js/apiInteractions.js

/**
 * Submits a job to the backend API.
 * @param {FormData} formData - FormData containing BAM and BAI files and region.
 * @returns {Object} - Response data containing job_id.
 */
async function submitJobToAPI(formData) {
    const response = await fetch(`${CONFIG.API_URL}/run-job/`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit job.');
    }

    const data = await response.json();
    return data;
}

/**
 * Polls the backend API for job status.
 * @param {string} jobId - The ID of the submitted job.
 * @param {function} onUpdate - Callback to handle status updates.
 * @param {function} onComplete - Callback when job is completed.
 * @param {function} onError - Callback when an error occurs.
 */
async function pollJobStatusAPI(jobId, onUpdate, onComplete, onError) {
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`${CONFIG.API_URL}/job-status/${jobId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch job status.');
            }

            const statusData = await response.json();
            onUpdate(statusData.status);

            if (statusData.status === 'Completed') {
                clearInterval(interval);
                onComplete();
            } else if (statusData.status === 'Failed') {
                clearInterval(interval);
                onError("Job processing failed. Please check the backend logs for more details.");
            }

        } catch (err) {
            console.error("Error while polling job status:", err);
            onError(`Error: ${err.message}`);
            clearInterval(interval);
        }
    }, 5000); // Poll every 5 seconds
}
