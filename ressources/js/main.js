// frontend/ressources/js/main.js

import { validateFiles } from './inputWrangling.js';
import { submitJobToAPI, pollJobStatusAPI } from './apiInteractions.js';
import { initializeAioli, extractRegion } from './bamProcessing.js';

/**
 * Initializes the application by setting up event listeners.
 */
async function initializeApp() {
    // Get references to DOM elements
    const submitBtn = document.getElementById("submitBtn");
    const extractBtn = document.getElementById("extractBtn");
    const spinner = document.getElementById("spinner");
    const countdownDiv = document.getElementById("countdown");
    const jobInfoDiv = document.getElementById("jobInfo");
    const jobStatusDiv = document.getElementById("jobStatus");
    const errorDiv = document.getElementById("error");

    let countdownInterval = null;
    let timeLeft = 20; // Countdown time in seconds

    // Submit Job Button Event Listener
    submitBtn.addEventListener("click", async () => {
        try {
            // Clear previous outputs and errors
            jobInfoDiv.innerHTML = "";
            jobStatusDiv.innerHTML = "";
            errorDiv.textContent = "";

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

            // Prepare FormData
            const formData = new FormData();
            matchedPairs.forEach(pair => {
                formData.append("bam_file", pair.bam);
                formData.append("bai_file", pair.bai);
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

            // Show spinner and initialize countdown
            spinner.style.display = "block";
            countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
            console.log("Spinner displayed and countdown started");

            // Initialize countdown timer
            countdownInterval = setInterval(() => {
                timeLeft--;
                if (timeLeft > 0) {
                    countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
                } else {
                    timeLeft = 20;
                    countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
                }
            }, 1000);

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
                    downloadLink.textContent = "Download vntyper results"; // Updated link text
                    downloadLink.classList.add("download-link");
                    downloadLink.target = "_blank"; // Open in a new tab

                    jobStatusDiv.appendChild(document.createElement("br"));
                    jobStatusDiv.appendChild(downloadLink);
                    console.log("Download link appended to jobStatusDiv");

                    // Hide spinner and countdown
                    spinner.style.display = "none";
                    countdownDiv.textContent = "";
                    clearInterval(countdownInterval);
                    console.log("Spinner and countdown hidden");
                },
                (errorMessage) => {
                    // On Error
                    displayError(errorMessage);
                    console.error(`Job failed with error: ${errorMessage}`);

                    // Hide spinner and countdown
                    spinner.style.display = "none";
                    countdownDiv.textContent = "";
                    clearInterval(countdownInterval);
                    console.log("Spinner and countdown hidden due to error");
                },
                () => {
                    // onPoll Callback to reset countdown
                    timeLeft = 20;
                    countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
                    console.log("Countdown reset to 20 seconds");
                }
            );

        } catch (err) {
            console.error("Error during job submission:", err);
            displayError(`Error: ${err.message}`);

            // Hide spinner and countdown in case of error
            spinner.style.display = "none";
            countdownDiv.textContent = "";
            clearInterval(countdownInterval);
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
                await extractRegion(CLI, matchedPairs);
            } catch (err) {
                displayError(`Error: ${err.message}`);
                console.error("Error during region extraction:", err);
            }
        });
    } catch (err) {
        console.error("Failed to initialize BAM processing:", err);
    }
}

/**
 * Displays an error message to the user.
 * @param {string} message - The error message to display.
 */
function displayError(message) {
    const errorDiv = document.getElementById("error");
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

// Initialize the application once the DOM is fully loaded
document.addEventListener("DOMContentLoaded", initializeApp);
