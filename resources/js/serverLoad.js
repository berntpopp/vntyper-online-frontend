// frontend/resources/js/serverLoad.js

import { getJobQueueStatus } from './apiInteractions.js';
import { logMessage } from './log.js'; // Import the logMessage function

/**
 * Initializes the server load monitoring system.
 * Updates the UI to reflect the current server load and adjusts polling intervals based on load.
 * @returns {Object} - Contains the updateServerLoad function.
 */
export function initializeServerLoad() {
    const totalJobsInQueueSpan = document.getElementById('totalJobsInQueue');
    const serverLoadIndicator = document.getElementById('serverLoadIndicator');

    if (!totalJobsInQueueSpan) {
        logMessage('Element #totalJobsInQueue not found in the DOM.', 'warning');
    }

    if (!serverLoadIndicator) {
        logMessage('Element #serverLoadIndicator not found in the DOM.', 'warning');
    }

    let serverLoadInterval = null;

    /**
     * Updates the server load by fetching the current job queue status.
     * Adjusts the polling interval based on the number of jobs in the queue.
     */
    async function updateServerLoad() {
        logMessage('Fetching current server load status...', 'info');
        try {
            const data = await getJobQueueStatus();
            const totalJobsInQueue = data.total_jobs_in_queue || 0;
            logMessage(`Total Jobs in Queue: ${totalJobsInQueue}`, 'info');

            if (totalJobsInQueueSpan) {
                totalJobsInQueueSpan.textContent = totalJobsInQueue;
                logMessage(`Updated #totalJobsInQueue to ${totalJobsInQueue}.`, 'info');
            }

            // Update color based on the number of jobs
            if (serverLoadIndicator) {
                serverLoadIndicator.classList.remove('load-orange', 'load-red', 'load-blue');
                if (totalJobsInQueue <= 2) {
                    serverLoadIndicator.classList.add('load-blue');
                    logMessage('Server load status set to BLUE (Low Load).', 'success');
                } else if (totalJobsInQueue > 2 && totalJobsInQueue <= 10) {
                    serverLoadIndicator.classList.add('load-orange');
                    logMessage('Server load status set to ORANGE (Moderate Load).', 'info');
                } else if (totalJobsInQueue > 10) {
                    serverLoadIndicator.classList.add('load-red');
                    logMessage('Server load status set to RED (High Load).', 'warning');
                }
            }

            adjustServerLoadUpdateInterval(totalJobsInQueue);

        } catch (error) {
            logMessage(`Error updating server load: ${error.message}`, 'error');
        }
    }

    /**
     * Adjusts the polling interval for updating server load based on the current load.
     * @param {number} totalJobsInQueue - The total number of jobs currently in the queue.
     */
    function adjustServerLoadUpdateInterval(totalJobsInQueue) {
        if (serverLoadInterval) {
            clearInterval(serverLoadInterval);
            serverLoadInterval = null;
            logMessage('Cleared existing server load polling interval.', 'info');
        }

        let intervalTime = 60000; // Default: 60 seconds

        if (totalJobsInQueue > 0) {
            intervalTime = 10000; // If there are jobs in the queue, poll every 10 seconds
            logMessage(`Adjusting polling interval to ${intervalTime / 1000} seconds due to active jobs in the queue.`, 'info');
        } else {
            logMessage(`Adjusting polling interval to ${intervalTime / 1000} seconds as the queue is empty.`, 'info');
        }

        serverLoadInterval = setInterval(updateServerLoad, intervalTime);
        logMessage('Set new server load polling interval.', 'info');
    }

    // Initial call to update the server load
    updateServerLoad();

    logMessage('Server load monitoring initialized.', 'info');

    return {
        updateServerLoad
    };
}
