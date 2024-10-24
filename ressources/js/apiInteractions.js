// frontend/ressources/js/apiInteractions.js

// Function to submit a job to the API
async function submitJobToAPI(formData) {
    const response = await fetch(`${window.CONFIG.API_URL}/run-job/`, {
        method: 'POST',
        body: formData
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit job.');
    }
    return response.json();
}

// Function to poll job status
async function pollJobStatusAPI(jobId, onStatusUpdate, onComplete, onError) {
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

export { submitJobToAPI, pollJobStatusAPI };
