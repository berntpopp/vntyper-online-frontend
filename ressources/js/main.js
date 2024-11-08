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
    const submitBtn = document.getElementById("submitBtn");
    const extractBtn = document.getElementById("extractBtn");
    const spinner = document.getElementById("spinner");
    const countdownDiv = document.getElementById("countdown");
    const jobInfoDiv = document.getElementById("jobInfo");
    const jobStatusDiv = document.getElementById("jobStatus");
    const errorDiv = document.getElementById("error");
    const institutionLogosDiv = document.getElementById("institutionLogos");
    const footerLinksDiv = document.getElementById("footerLinks");
    const currentYearSpan = document.getElementById("currentYear");

    let countdownInterval = null;
    let timeLeft = 20; // Countdown time in seconds

    /**
     * Displays an error message to the user.
     * @param {string} message - The error message to display.
     */
    function displayError(message) {
        errorDiv.textContent = message;
    }

    /**
     * Capitalizes the first letter of a string.
     * @param {string} string - The string to capitalize.
     * @returns {string} - The capitalized string.
     */
    function capitalizeFirstLetter(string) {
        if (!string) return "";
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    /**
     * Shows the spinner by toggling CSS classes.
     */
    function showSpinner() {
        spinner.classList.remove('hidden');
        spinner.classList.add('visible');
    }

    /**
     * Hides the spinner by toggling CSS classes.
     */
    function hideSpinner() {
        spinner.classList.remove('visible');
        spinner.classList.add('hidden');
    }

    /**
     * Shows the spinner and initializes countdown.
     */
    function startCountdown() {
        countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
        countdownInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
            } else {
                timeLeft = 20;
                countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
            }
        }, 1000);
    }

    /**
     * Resets the countdown timer.
     */
    function resetCountdown() {
        timeLeft = 20;
        countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
    }

    /**
     * Clears the countdown interval.
     */
    function clearCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            countdownDiv.textContent = "";
        }
    }

    /**
     * Dynamically generates the footer institution logos and links.
     */
    function generateFooter() {
        const institutions = window.CONFIG.institutions || [];

        // Clear existing content to avoid duplication
        institutionLogosDiv.innerHTML = '';
        footerLinksDiv.innerHTML = '';

        // Generate Institution Logos
        institutions.forEach(inst => {
            const link = document.createElement('a');
            link.href = inst.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            const img = document.createElement('img');
            img.src = `ressources/assets/logos/${inst.logo}`;
            img.alt = `${inst.name} Logo`;
            img.classList.add('institution-logo');
            img.loading = "lazy";

            link.appendChild(img);
            institutionLogosDiv.appendChild(link);
        });
    }

    /**
     * Sets the current year in the footer.
     */
    function setCurrentYear() {
        const currentYear = new Date().getFullYear();
        currentYearSpan.textContent = currentYear;
    }

    // Submit Job Button Event Listener
    submitBtn.addEventListener("click", async () => {
        try {
            // Clear previous outputs and errors
            jobInfoDiv.innerHTML = "";
            jobStatusDiv.innerHTML = "";
            displayError("");

            // Get selected files and validate
            const fileInputs = document.getElementById("bamFiles");
            const selectedFiles = Array.from(fileInputs.files);
            const { matchedPairs } = validateFiles(selectedFiles);
            const region = document.getElementById("region").value;

            if (!region) {
                displayError("Please select a region.");
                console.warn("Region selection error: No region selected.");
                return;
            }

            if (matchedPairs.length === 0) {
                displayError("No valid BAM and BAI file pairs found.");
                console.warn("File validation error: No matched pairs.");
                return;
            }

            // Show spinner and initialize countdown
            showSpinner();
            startCountdown();
            console.log("Spinner displayed and countdown started");

            // Initialize Aioli and extract subset BAM and BAI
            const CLI = await initializeAioli();
            const subsetBamAndBaiBlobs = await extractRegionAndIndex(CLI, matchedPairs);
            console.log("Subsetted BAM and BAI Blobs:", subsetBamAndBaiBlobs);

            // Prepare FormData with subsetted BAM and BAI files
            const formData = new FormData();

            subsetBamAndBaiBlobs.forEach((subset, index) => {
                const { subsetBamBlob, subsetBaiBlob, subsetName } = subset;
                const originalPair = matchedPairs[index];
                const subsetBamFileName = subsetName; // e.g., subset_test.bam
                const subsetBaiFileName = `${subsetName}.bai`; // e.g., subset_test.bam.bai

                formData.append("bam_file", subsetBamBlob, subsetBamFileName);
                formData.append("bai_file", subsetBaiBlob, subsetBaiFileName);
            });

            // Compute reference_assembly based on region
            const referenceAssemblyMap = {
                "chr1:155158000-155163000": "hg19",
                "chr1:155184000-155194000": "hg38"
            };
            const referenceAssembly = referenceAssemblyMap[region];
            formData.append("reference_assembly", referenceAssembly);

            // Add additional parameters
            formData.append("fast_mode", "true");
            formData.append("keep_intermediates", "true");
            formData.append("archive_results", "true");

            // Disable button and indicate submission
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting...";
            console.log("Submit button disabled and text changed to 'Submitting...'");

            // Submit job to API
            const data = await submitJobToAPI(formData);
            console.log("Job Submission Response:", data);

            // Update job info and initial status
            jobInfoDiv.innerHTML = `Job submitted successfully!<br>Job ID: <strong>${data.job_id}</strong>`;
            jobStatusDiv.innerHTML = `Status: <strong>Submitted</strong>`;
            console.log("Initial status 'Submitted' displayed");

            // Poll job status
            pollJobStatusAPI(
                data.job_id,
                (status) => {
                    // Update status in the jobStatusDiv
                    jobStatusDiv.innerHTML = `Status: <strong>${capitalizeFirstLetter(status)}</strong>`;
                    console.log(`Status updated to: ${status}`);
                },
                () => {
                    // On Complete
                    const downloadLink = document.createElement("a");
                    downloadLink.href = `${window.CONFIG.API_URL}/download/${data.job_id}/`;
                    downloadLink.textContent = "Download vntyper results";
                    downloadLink.classList.add("download-link");
                    downloadLink.target = "_blank"; // Open in a new tab

                    jobStatusDiv.appendChild(document.createElement("br"));
                    jobStatusDiv.appendChild(downloadLink);
                    console.log("Download link appended to jobStatusDiv");

                    // Hide spinner and countdown
                    hideSpinner();
                    clearCountdown();
                    console.log("Spinner and countdown hidden");
                },
                (errorMessage) => {
                    // On Error
                    displayError(errorMessage);
                    console.error(`Job failed with error: ${errorMessage}`);

                    // Hide spinner and countdown
                    hideSpinner();
                    clearCountdown();
                    console.log("Spinner and countdown hidden due to error");
                },
                () => {
                    // onPoll Callback to reset countdown
                    resetCountdown();
                    console.log("Countdown reset to 20 seconds");
                }
            );

        } catch (err) {
            console.error("Error during job submission:", err);
            displayError(`Error: ${err.message}`);

            // Hide spinner and countdown in case of error
            hideSpinner();
            clearCountdown();
            console.log("Spinner and countdown hidden due to exception");
        } finally {
            // Reset the button
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Job";
            console.log("Submit button re-enabled and text reset to 'Submit Job'");
        }
    });

    // Initialize BAM Processing and set up Extract Button Event Listener
    try {
        const CLI = await initializeAioli();
        extractBtn.addEventListener("click", async () => {
            const fileInputs = document.getElementById("bamFiles");
            const selectedFiles = Array.from(fileInputs.files);

            try {
                const { matchedPairs } = validateFiles(selectedFiles);
                if (matchedPairs.length === 0) {
                    displayError("No valid BAM and BAI file pairs found for extraction.");
                    console.warn("File validation error: No matched pairs for extraction.");
                    return;
                }
                const subsetBamAndBaiBlobs = await extractRegionAndIndex(CLI, matchedPairs);
                
                // Provide download links for the subsetted BAM and BAI files
                subsetBamAndBaiBlobs.forEach(subset => {
                    const { subsetBamBlob, subsetBaiBlob, subsetName } = subset;
                    const subsetBaiName = `${subsetName}.bai`;

                    const downloadBamUrl = URL.createObjectURL(subsetBamBlob);
                    const downloadBaiUrl = URL.createObjectURL(subsetBaiBlob);
                    
                    // Download Link for BAM
                    const downloadBamLink = document.createElement("a");
                    downloadBamLink.href = downloadBamUrl;
                    downloadBamLink.download = subsetName;
                    downloadBamLink.textContent = `Download ${subsetName}`;
                    downloadBamLink.classList.add("download-link");

                    // Download Link for BAI
                    const downloadBaiLink = document.createElement("a");
                    downloadBaiLink.href = downloadBaiUrl;
                    downloadBaiLink.download = subsetBaiName;
                    downloadBaiLink.textContent = `Download ${subsetBaiName}`;
                    downloadBaiLink.classList.add("download-link");

                    // Append links to the regionOutput div
                    const linkContainer = document.createElement("div");
                    linkContainer.appendChild(downloadBamLink);
                    linkContainer.appendChild(document.createElement("br"));
                    linkContainer.appendChild(downloadBaiLink);
                    linkContainer.appendChild(document.createElement("hr"));

                    document.getElementById("regionOutput").appendChild(linkContainer);
                });

                // Optional: Revoke the Object URLs after some time to free memory
                setTimeout(() => {
                    document.querySelectorAll('#regionOutput a').forEach(link => {
                        URL.revokeObjectURL(link.href);
                        console.log(`Object URL revoked for ${link.download}`);
                    });
                }, 60000); // Revoke after 60 seconds

            } catch (err) {
                displayError(`Error: ${err.message}`);
                console.error("Error during region extraction and indexing:", err);
            }
        });
    } catch (err) {
        console.error("Failed to initialize BAM processing:", err);
    }

    // Generate the footer content dynamically
    generateFooter();

    // Set the current year dynamically
    setCurrentYear();
}

// Initialize the application once the DOM is fully loaded
document.addEventListener("DOMContentLoaded", initializeApp);
