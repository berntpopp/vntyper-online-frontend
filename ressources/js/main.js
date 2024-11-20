// frontend/ressources/js/main.js

import { validateFiles } from './inputWrangling.js';
import { submitJobToAPI, pollJobStatusAPI } from './apiInteractions.js';
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
    clearCountdown
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

    // Variable to store selected files
    let selectedFiles = [];

    // Initialize file selection
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

            // Initialize Aioli and extract subset BAM and BAI
            const CLI = await initializeAioli();
            const { matchedPairs } = validateFiles(selectedFiles, false);
            if (matchedPairs.length === 0) {
                displayError('No valid BAM and BAI file pairs found for extraction.');
                console.warn('File validation error: No matched pairs for extraction.');
                return;
            }

            // Extract region and detect assembly
            const {
                subsetBamAndBaiBlobs,
                detectedAssembly,
                region
            } = await extractRegionAndIndex(CLI, matchedPairs);
            console.log('Subsetted BAM and BAI Blobs:', subsetBamAndBaiBlobs);
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
                hideSpinner();
                clearCountdown();
                return;
            }

            // Prepare FormData with subsetted BAM and BAI files
            const formData = new FormData();

            subsetBamAndBaiBlobs.forEach((subset, index) => {
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

            // Disable button and indicate submission
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            console.log('Submit button disabled and text changed to "Submitting..."');

            // Submit job to API
            const data = await submitJobToAPI(formData);
            console.log('Job Submission Response:', data);

            // Update job info and initial status
            jobInfoDiv.innerHTML = `Job submitted successfully!<br>Job ID: <strong>${data.job_id}</strong>`;
            jobStatusDiv.innerHTML = 'Status: <strong>Submitted</strong>';
            console.log('Initial status "Submitted" displayed');

            // Poll job status
            pollJobStatusAPI(
                data.job_id,
                (status) => {
                    // Update status in the jobStatusDiv
                    jobStatusDiv.innerHTML = `Status: <strong>${capitalizeFirstLetter(
                        status
                    )}</strong>`;
                    console.log(`Status updated to: ${status}`);
                },
                () => {
                    // On Complete
                    const downloadLink = document.createElement('a');
                    downloadLink.href = `${window.CONFIG.API_URL}/download/${data.job_id}/`;
                    downloadLink.textContent = 'Download vntyper results';
                    downloadLink.classList.add('download-link', 'download-button');
                    downloadLink.target = '_blank'; // Open in a new tab

                    jobStatusDiv.appendChild(document.createElement('br'));
                    jobStatusDiv.appendChild(downloadLink);
                    console.log('Download link appended to jobStatusDiv');

                    // Hide spinner and countdown
                    hideSpinner();
                    clearCountdown();
                    console.log('Spinner and countdown hidden');

                    // Clear job queue position
                    jobQueuePositionDiv.innerHTML = '';

                    // Update server load indicator after job completion
                    serverLoad.updateServerLoad();
                },
                (errorMessage) => {
                    // On Error
                    displayError(errorMessage);
                    console.error(`Job failed with error: ${errorMessage}`);

                    // Hide spinner and countdown
                    hideSpinner();
                    clearCountdown();
                    console.log('Spinner and countdown hidden due to error');

                    // Clear job queue position
                    jobQueuePositionDiv.innerHTML = '';

                    // Update server load indicator after job failure
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
            const { matchedPairs } = validateFiles(selectedFiles, false);
            if (matchedPairs.length === 0) {
                displayError('No valid BAM and BAI file pairs found for extraction.');
                console.warn('File validation error: No matched pairs for extraction.');
                return;
            }

            // Extract region and detect assembly
            const {
                subsetBamAndBaiBlobs,
                detectedAssembly,
                region
            } = await extractRegionAndIndex(CLI, matchedPairs);
            console.log('Subsetted BAM and BAI Blobs:', subsetBamAndBaiBlobs);
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

                // Append links to the regionOutput div
                const linkContainer = document.createElement('div');
                linkContainer.classList.add('download-container', 'mb-2');
                linkContainer.appendChild(downloadBamLink);
                linkContainer.appendChild(document.createElement('br'));
                linkContainer.appendChild(downloadBaiLink);
                linkContainer.appendChild(document.createElement('hr'));

                regionOutputDiv.appendChild(linkContainer);
            });

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
}

// Initialize the application once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
