// frontend/ressources/js/main.js

import { validateFiles } from './inputWrangling.js';
import { submitJobToAPI, pollJobStatusAPI, getJobStatus, createCohort } from './apiInteractions.js';
import { initializeAioli, extractRegionAndIndex } from './bamProcessing.js';
import { initializeModal, checkAndShowDisclaimer } from './modal.js';
import { initializeFooter } from './footer.js';
import { initializeFAQ } from './faq.js';
import { initializeUserGuide } from './userGuide.js';
import { initializeCitations } from './citations.js';
import { initializeTutorial } from './tutorial.js';
import { regions } from './regionsConfig.js';
import { displayError, clearError } from './errorHandling.js';
import {
    showSpinner,
    hideSpinner,
    startCountdown,
    resetCountdown,
    clearCountdown,
    initializeUIUtils
} from './uiUtils.js';
import { initializeFileSelection } from './fileSelection.js';
import { initializeServerLoad } from './serverLoad.js';

/**
 * Initializes the application by setting up event listeners and dynamic content.
 */
async function initializeApp() {
    // Initialize modal and footer functionalities
    initializeModal();
    initializeFooter();

    // Initialize other sections
    initializeFAQ();
    initializeUserGuide();
    initializeCitations();
    initializeTutorial();

    // Initialize UI Utilities (includes toggle functionality)
    initializeUIUtils();

    // Check and show disclaimer modal or indicator based on acknowledgment
    checkAndShowDisclaimer();

    // Get references to DOM elements
    const submitBtn = document.getElementById('submitBtn');
    const extractBtn = document.getElementById('extractBtn');
    const jobInfoDiv = document.getElementById('jobInfo');
    const jobStatusDiv = document.getElementById('jobStatus');
    const jobQueuePositionDiv = document.getElementById('jobQueuePosition');
    const regionSelect = document.getElementById('region');
    const regionOutputDiv = document.getElementById('regionOutput');
    const emailInput = document.getElementById('email');
    const cohortAliasInput = document.getElementById('cohortAlias');
    const passphraseInput = document.getElementById('passphrase'); // **Added**

    // Initialize file selection
    let selectedFiles = [];
    const fileSelection = initializeFileSelection(selectedFiles);
    const { displaySelectedFiles } = fileSelection;

    // Initialize server load monitoring
    const serverLoad = initializeServerLoad();

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
     * Displays a message to the user in the output area.
     * @param {string} message - The message to display.
     * @param {string} type - The type of message ('info', 'error', 'success').
     */
    function displayMessage(message, type = 'info') {
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.innerHTML = message;
            messageDiv.className = ''; // Reset classes
            messageDiv.classList.add('message', `message-${type}`);
            messageDiv.classList.remove('hidden');
        }
    }

    /**
     * Clears the displayed message.
     */
    function clearMessage() {
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.innerHTML = '';
            messageDiv.className = ''; // Reset classes
            messageDiv.classList.add('message', 'hidden');
        }
    }

    /**
     * Generates a shareable URL containing the job ID.
     * @param {string} jobId - The job identifier.
     * @returns {string} - The shareable URL.
     */
    function generateShareableLink(jobId) {
        const url = new URL(window.location.href);
        url.searchParams.set('job_id', jobId);
        return url.toString();
    }

    /**
     * Displays the shareable link to the user within the jobInfoDiv.
     * Includes a copy link icon next to it.
     * @param {string} jobId - The job identifier.
     */
    function displayShareableLink(jobId) {
        const shareContainer = document.createElement('div');
        shareContainer.classList.add('share-container', 'mt-2');

        const shareLabel = document.createElement('span');
        shareLabel.textContent = 'Shareable Link: ';
        shareContainer.appendChild(shareLabel);

        const shareLink = document.createElement('input');
        shareLink.type = 'text';
        shareLink.value = generateShareableLink(jobId);
        shareLink.readOnly = true;
        shareLink.classList.add('share-link-input');

        // Add copy icon/button
        const copyIcon = document.createElement('button');
        copyIcon.classList.add('copy-button');
        copyIcon.setAttribute('aria-label', 'Copy link');
        copyIcon.innerHTML = '📋'; // Using clipboard emoji as copy icon
        copyIcon.addEventListener('click', () => {
            shareLink.select();
            document.execCommand('copy');
            copyIcon.textContent = '✅'; // Change icon to indicate success
            setTimeout(() => {
                copyIcon.textContent = '📋'; // Revert icon back
            }, 2000);
        });

        shareContainer.appendChild(shareLink);
        shareContainer.appendChild(copyIcon);

        // Append to jobInfoDiv
        jobInfoDiv.appendChild(shareContainer);
    }

    /**
     * Fetches the current job status and updates the UI immediately.
     * Utilizes the getJobStatus function from apiInteractions.js.
     * @param {string} jobId - The job identifier.
     */
    async function fetchAndUpdateJobStatus(jobId) {
        try {
            const data = await getJobStatus(jobId);

            // Update job status in the UI
            const statusElement = document.getElementById(`status-${jobId}`);
            if (statusElement) {
                statusElement.innerHTML = `Status: <strong>${capitalizeFirstLetter(data.status)}</strong>`;
            }
            console.log(`Status fetched: ${data.status}`);

            if (data.status === 'completed') {
                // On Complete
                displayDownloadLink(jobId);
                hideSpinner();
                clearCountdown();
                jobQueuePositionDiv.innerHTML = '';
                serverLoad.updateServerLoad();
            } else if (data.status === 'failed') {
                // On Error
                const errorMessage = data.error || 'Job failed.';
                displayError(errorMessage);
                console.error(`Job failed with error: ${errorMessage}`);
                hideSpinner();
                clearCountdown();
                jobQueuePositionDiv.innerHTML = '';
                serverLoad.updateServerLoad();
            } else {
                // Job is still processing
                console.log(`Job is in status: ${data.status}`);
            }
        } catch (error) {
            console.error('Error fetching job status:', error);
            displayError(`Error fetching job status: ${error.message}`);
            hideSpinner();
            clearCountdown();
        }
    }

    /**
     * Fetches and displays job details based on the job ID.
     * Utilizes pollJobStatusAPI to retrieve job status and details.
     * Performs an immediate poll and then continues polling at intervals.
     * @param {string} jobId - The job identifier.
     */
    async function loadJobFromURL(jobId) {
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

            // Generate and display the shareable link
            displayShareableLink(jobId);

            // Create a status element for this job
            const statusElement = document.createElement('div');
            statusElement.id = `status-${jobId}`;
            statusElement.innerHTML = `Status: <strong>Loading...</strong>`;
            jobStatusDiv.appendChild(statusElement);

            // Immediately fetch and update job status
            await fetchAndUpdateJobStatus(jobId);

            // Start polling job status every 20 seconds
            pollJobStatusAPI(
                jobId,
                (status) => {
                    // Update status in the jobStatusDiv
                    if (statusElement) {
                        statusElement.innerHTML = `Status: <strong>${capitalizeFirstLetter(status)}</strong>`;
                    }
                    console.log(`Status updated to: ${status}`);
                },
                () => {
                    // On Complete
                    displayDownloadLink(jobId);
                    hideSpinner();
                    clearCountdown();
                    console.log('Spinner and countdown hidden');
                    jobQueuePositionDiv.innerHTML = '';
                    serverLoad.updateServerLoad();
                },
                (errorMessage) => {
                    // On Error
                    displayError(errorMessage);
                    console.error(`Job ${jobId} failed with error: ${errorMessage}`);
                    hideSpinner();
                    clearCountdown();
                    console.log('Spinner and countdown hidden due to error');
                    jobQueuePositionDiv.innerHTML = '';
                    serverLoad.updateServerLoad();
                },
                () => {
                    // onPoll Callback to reset countdown
                    resetCountdown();
                    console.log('Countdown reset to 20 seconds');
                },
                (queueData) => {
                    // onQueueUpdate callback
                    const { position_in_queue, total_jobs_in_queue, status } = queueData;
                    if (position_in_queue) {
                        jobQueuePositionDiv.innerHTML = `Position in Queue: <strong>${position_in_queue}</strong> out of <strong>${total_jobs_in_queue}</strong>`;
                    } else if (status) {
                        jobQueuePositionDiv.innerHTML = `${status}`;
                    } else {
                        jobQueuePositionDiv.innerHTML = '';
                    }
                    // Update server load indicator
                    serverLoad.updateServerLoad();
                }
            );

            hideSpinner();
        } catch (error) {
            console.error('Error loading job from URL:', error);
            displayError(`Error loading job: ${error.message}`);
            hideSpinner();
        }
    }

    /**
     * Checks URL parameters for job_id and loads the job if present.
     */
    function checkURLForJob() {
        const urlParams = new URLSearchParams(window.location.search);
        const jobId = urlParams.get('job_id');
        if (jobId) {
            loadJobFromURL(jobId);
        }
    }

    /**
     * Displays the download link once the job is completed.
     * @param {string} jobId - The job identifier.
     */
    function displayDownloadLink(jobId) {
        const downloadLink = document.createElement('a');
        downloadLink.href = `${window.CONFIG.API_URL}/download/${jobId}/`;
        downloadLink.textContent = 'Download vntyper results';
        downloadLink.classList.add('download-link', 'download-button');
        downloadLink.target = '_blank'; // Open in a new tab
    
        jobStatusDiv.appendChild(document.createElement('br'));
        jobStatusDiv.appendChild(downloadLink);
        console.log('Download link appended to jobStatusDiv');
    }

    /**
     * Handle Job Submission via Submit Button
     */
    submitBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) {
            displayError('No files selected. Please upload BAM and BAI files.');
            return;
        }

        try {
            // Clear previous outputs and errors
            jobInfoDiv.innerHTML = '';
            jobStatusDiv.innerHTML = '';
            jobQueuePositionDiv.innerHTML = '';
            regionOutputDiv.innerHTML = '';
            clearError();
            clearMessage();

            // Show spinner and initialize countdown
            showSpinner();
            startCountdown();
            console.log('Spinner displayed and countdown started');

            // Initialize Aioli and validate selected files
            const CLI = await initializeAioli();
            const { matchedPairs, invalidFiles } = validateFiles(selectedFiles, false);

            if (invalidFiles.length > 0) {
                displayError(`Some files were invalid and not added: ${invalidFiles.map(f => f.name).join(', ')}`);
                console.warn('Invalid files detected.');
            }

            if (matchedPairs.length === 0) {
                displayError('No valid BAM and BAI file pairs found for submission.');
                console.warn('No valid file pairs.');
                hideSpinner();
                clearCountdown();
                return;
            }

            // Capture email, cohort alias, and passphrase inputs
            const email = emailInput.value.trim() || null;
            const cohortAlias = cohortAliasInput.value.trim() || null;
            const passphrase = passphraseInput.value.trim() || null; // **Captured Passphrase**

            let cohortId = null;

            // Determine if batch submission is needed
            if (matchedPairs.length > 1) {
                // **Batch Submission: Create a Cohort**
                if (!cohortAlias) {
                    displayError('Cohort Alias is required for batch submissions.');
                    hideSpinner();
                    clearCountdown();
                    return;
                }
                if (!passphrase) { // **Ensure passphrase is provided**
                    displayError('Passphrase is required for cohort creation.');
                    hideSpinner();
                    clearCountdown();
                    return;
                }
                const cohortData = await createCohort(cohortAlias, passphrase); // **Pass alias and passphrase**
                cohortId = cohortData.cohort_id; // **Retrieve cohort_id from response**
            }

            // Iterate through each matched pair and submit jobs sequentially
            const jobIds = [];

            for (const pair of matchedPairs) {
                const { bam, bai } = pair;

                // Extract region and detect assembly
                const { subsetBamAndBaiBlobs, detectedAssembly, region } = await extractRegionAndIndex(CLI, pair);
                console.log('Subset BAM and BAI Blobs:', subsetBamAndBaiBlobs);
                console.log('Detected Assembly:', detectedAssembly);
                console.log('Region used:', region);

                // Prepare FormData with subsetted BAM and BAI files
                const formData = new FormData();

                subsetBamAndBaiBlobs.forEach((subset) => {
                    const { subsetBamBlob, subsetBaiBlob, subsetName } = subset;
                    const subsetBamFileName = subsetName; // e.g., subset_test.bam
                    const subsetBaiFileName = `${subsetName}.bai`; // e.g., subset_test.bam.bai

                    formData.append('bam_file', subsetBamBlob, subsetBamFileName);
                    formData.append('bai_file', subsetBaiBlob, subsetBaiFileName);
                });

                // Use the detected assembly and region
                formData.append('reference_assembly', detectedAssembly);
                formData.append('region', region);

                // Add additional parameters
                formData.append('fast_mode', 'true');
                formData.append('keep_intermediates', 'true');
                formData.append('archive_results', 'true');

                // Add email and cohort information if available
                if (email) {
                    formData.append('email', email);
                }
                if (cohortId) {
                    formData.append('cohort_id', cohortId);
                }

                // Submit job to API
                const data = await submitJobToAPI(formData);
                console.log('Job Submission Response:', data);

                jobIds.push(data.job_id);

                // Display job information
                const jobInfo = document.createElement('div');
                jobInfo.innerHTML = `Job submitted successfully!<br>Job ID: <strong>${data.job_id}</strong>`;
                jobInfoDiv.appendChild(jobInfo);

                // Generate and display shareable link
                displayShareableLink(data.job_id);

                // Create a status element for this job
                const statusElement = document.createElement('div');
                statusElement.id = `status-${data.job_id}`;
                statusElement.innerHTML = `Status: <strong>Submitted</strong>`;
                jobStatusDiv.appendChild(statusElement);

                // Immediately fetch and update job status
                await fetchAndUpdateJobStatus(data.job_id);

                // Start polling job status every 20 seconds
                pollJobStatusAPI(
                    data.job_id,
                    (status) => {
                        // Update status in the jobStatusDiv
                        if (statusElement) {
                            statusElement.innerHTML = `Status: <strong>${capitalizeFirstLetter(status)}</strong>`;
                        }
                        console.log(`Status updated to: ${status}`);
                    },
                    () => {
                        // On Complete
                        displayDownloadLink(data.job_id);
                        hideSpinner();
                        clearCountdown();
                        console.log('Spinner and countdown hidden');
                        jobQueuePositionDiv.innerHTML = '';
                        serverLoad.updateServerLoad();
                    },
                    (errorMessage) => {
                        // On Error
                        displayError(errorMessage);
                        console.error(`Job failed with error: ${errorMessage}`);
                        hideSpinner();
                        clearCountdown();
                        console.log('Spinner and countdown hidden due to error');
                        jobQueuePositionDiv.innerHTML = '';
                        serverLoad.updateServerLoad();
                    },
                    () => {
                        // onPoll Callback to reset countdown
                        resetCountdown();
                        console.log('Countdown reset to 20 seconds');
                    },
                    (queueData) => {
                        // onQueueUpdate callback
                        const { position_in_queue, total_jobs_in_queue, status } = queueData;
                        if (position_in_queue) {
                            jobQueuePositionDiv.innerHTML = `Position in Queue: <strong>${position_in_queue}</strong> out of <strong>${total_jobs_in_queue}</strong>`;
                        } else if (status) {
                            jobQueuePositionDiv.innerHTML = `${status}`;
                        } else {
                            jobQueuePositionDiv.innerHTML = '';
                        }
                        // Update server load indicator
                        serverLoad.updateServerLoad();
                    }
                );
            }

            // Optionally, clear selected files after submission
            selectedFiles = [];
            displaySelectedFiles();

        } catch (err) {
            console.error('Error during job submission:', err);
            displayError(`Error: ${err.message}`);

            // Hide spinner and countdown in case of error
            hideSpinner();
            clearCountdown();
            console.log('Spinner and countdown hidden due to exception');

            // Clear job queue position
            jobQueuePositionDiv.innerHTML = '';

            // Update server load indicator after error
            serverLoad.updateServerLoad();
        } finally {
            // Reset the button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Job';
            console.log('Submit button re-enabled and text reset to "Submit Job"');
        }
    });

    /**
     * Handle Region Extraction via Extract Button
     */
    extractBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) {
            displayError('No files selected. Please upload BAM and BAI files.');
            return;
        }

        try {
            // Clear previous outputs and errors
            regionOutputDiv.innerHTML = '';
            clearError();
            clearMessage();

            const CLI = await initializeAioli();
            const { matchedPairs, invalidFiles } = validateFiles(selectedFiles, false);

            if (invalidFiles.length > 0) {
                displayError(`Some files were invalid and not added: ${invalidFiles.map(f => f.name).join(', ')}`);
                console.warn('Invalid files detected.');
            }

            if (matchedPairs.length === 0) {
                displayError('No valid BAM and BAI file pairs found for extraction.');
                console.warn('No valid file pairs.');
                return;
            }

            // Extract region and detect assembly for each pair
            for (const pair of matchedPairs) {
                const { subsetBamAndBaiBlobs, detectedAssembly, region } = await extractRegionAndIndex(CLI, pair);
                console.log('Subset BAM and BAI Blobs:', subsetBamAndBaiBlobs);
                console.log('Detected Assembly:', detectedAssembly);
                console.log('Region used:', region);

                // Update the region select dropdown based on detected assembly
                if (detectedAssembly) {
                    regionSelect.value = detectedAssembly;

                    // Display message about the detected assembly
                    displayMessage(
                        `Detected reference assembly: ${detectedAssembly.toUpperCase()}. Please confirm or select manually.`,
                        'info'
                    );
                } else {
                    // Prompt the user to select manually
                    displayMessage(
                        'Could not automatically detect the reference assembly. Please select it manually.',
                        'error'
                    );
                    regionSelect.value = ''; // Reset selection
                    return;
                }

                // Provide download links for the subsetted BAM and BAI files
                subsetBamAndBaiBlobs.forEach((subset) => {
                    const { subsetBamBlob, subsetBaiBlob, subsetName } = subset;
                    const subsetBaiName = `${subsetName}.bai`;

                    const downloadBamUrl = URL.createObjectURL(subsetBamBlob);
                    const downloadBaiUrl = URL.createObjectURL(subsetBaiBlob);

                    // Download Link for BAM
                    const downloadBamLink = document.createElement('a');
                    downloadBamLink.href = downloadBamUrl;
                    downloadBamLink.download = subsetName;
                    downloadBamLink.textContent = `Download ${subsetName}`;
                    downloadBamLink.classList.add('download-link', 'download-button');

                    // Download Link for BAI
                    const downloadBaiLink = document.createElement('a');
                    downloadBaiLink.href = downloadBaiUrl;
                    downloadBaiLink.download = subsetBaiName;
                    downloadBaiLink.textContent = `Download ${subsetBaiName}`;
                    downloadBaiLink.classList.add('download-link', 'download-button');

                    // Create a container for the download links
                    const linkContainer = document.createElement('div');
                    linkContainer.classList.add('download-container', 'mb-2'); // Ensure 'mb-2' is defined in your CSS or remove if unnecessary
                    linkContainer.appendChild(downloadBamLink);
                    linkContainer.appendChild(downloadBaiLink);

                    // Append the container to the regionOutput div
                    regionOutputDiv.appendChild(linkContainer);

                    // Create and append the horizontal divider after the container
                    const divider = document.createElement('hr');
                    divider.classList.add('separator'); // Applies the styles from buttons.css
                    regionOutputDiv.appendChild(divider);
                });
            }

            // Optionally: Revoke the Object URLs after some time to free memory
            setTimeout(() => {
                document.querySelectorAll('#regionOutput a').forEach((link) => {
                    URL.revokeObjectURL(link.href);
                    console.log(`Object URL revoked for ${link.download}`);
                });
            }, 60000); // Revoke after 60 seconds

        } catch (err) {
            displayError(`Error: ${err.message}`);
            console.error('Error during region extraction and indexing:', err);
        }
    });

    // Check URL for job_id on initial load
    checkURLForJob();
}

// Initialize the application once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
