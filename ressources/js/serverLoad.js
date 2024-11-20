// frontend/ressources/js/serverLoad.js

import { getJobQueueStatus } from './apiInteractions.js';

export function initializeServerLoad() {
    const totalJobsInQueueSpan = document.getElementById('totalJobsInQueue');
    const serverLoadIndicator = document.getElementById('serverLoadIndicator');

    let serverLoadInterval = null;

    async function updateServerLoad() {
        try {
            const data = await getJobQueueStatus();
            const totalJobsInQueue = data.total_jobs_in_queue || 0;
            totalJobsInQueueSpan.textContent = totalJobsInQueue;

            // Update color based on the number of jobs
            if (totalJobsInQueue <= 2) {
                serverLoadIndicator.classList.remove('load-orange', 'load-red');
                serverLoadIndicator.classList.add('load-blue');
            } else if (totalJobsInQueue > 2 && totalJobsInQueue <= 10) {
                serverLoadIndicator.classList.remove('load-blue', 'load-red');
                serverLoadIndicator.classList.add('load-orange');
            } else if (totalJobsInQueue > 10) {
                serverLoadIndicator.classList.remove('load-blue', 'load-orange');
                serverLoadIndicator.classList.add('load-red');
            }

            adjustServerLoadUpdateInterval(totalJobsInQueue);

        } catch (error) {
            console.error('Error updating server load:', error);
        }
    }

    function adjustServerLoadUpdateInterval(totalJobsInQueue) {
        if (serverLoadInterval) {
            clearInterval(serverLoadInterval);
            serverLoadInterval = null;
        }

        let intervalTime = 60000;

        if (totalJobsInQueue > 0) {
            intervalTime = 10000;
        }

        serverLoadInterval = setInterval(updateServerLoad, intervalTime);
    }

    // Initial call to update the server load
    updateServerLoad();

    return {
        updateServerLoad
    };
}
