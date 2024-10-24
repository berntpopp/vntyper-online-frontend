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
    const outputDiv = document.getElementById("output");
    const errorDiv = document.getElementById("error");

    let countdownInterval = null;
    let timeLeft = 20; // Countdown time in seconds

    // Submit Job Button Event Listener
    submitBtn.addEventListener("click", async () => {
        try {
            // Clear previous outputs and errors
            outputDiv.innerHTML = "";
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

            // Show spinner and initialize countdown
            spinner.style.display = "block";
            countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;

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

            // Update output with initial status
            outputDiv.innerHTML = `Job submitted successfully!<br>Job ID: <strong>${data.job_id}</strong><br>Status: <strong>Pending...</strong>`;

            // Poll job status
            pollJobStatusAPI(
                data.job_id,
                (status) => {
                    // Update status in the output div
                    const jobIdElement = outputDiv.querySelector("strong");
                    if (jobIdElement) {
                        // Find the next sibling text node after Job ID
                        const siblings = Array.from(outputDiv.childNodes);
                        const statusNode = siblings.find(node => node.nodeType === Node.TEXT_NODE && node.textContent.includes("Status:"));
                        if (statusNode) {
                            statusNode.textContent = `\nStatus: ${status}`;
                        } else {
                            // If not found, append the status
                            outputDiv.innerHTML += `<br>Status: <strong>${status}</strong>`;
                        }
                    }
                },
                () => {
                    // On Complete
                    const downloadLink = document.createElement("a");
                    downloadLink.href = `${window.CONFIG.API_URL}/download/${data.job_id}/`;
                    downloadLink.textContent = "Download vntyper results"; // Updated link text
                    downloadLink.classList.add("download-link");
                    downloadLink.target = "_blank"; // Open in a new tab

                    outputDiv.appendChild(document.createElement("br"));
                    outputDiv.appendChild(downloadLink);

                    // Hide spinner and countdown
                    spinner.style.display = "none";
                    countdownDiv.textContent = "";
                    clearInterval(countdownInterval);
                },
                (errorMessage) => {
                    // On Error
                    displayError(errorMessage);

                    // Hide spinner and countdown
                    spinner.style.display = "none";
                    countdownDiv.textContent = "";
                    clearInterval(countdownInterval);
                },
                () => {
                    // onPoll Callback to reset countdown
                    timeLeft = 20;
                    countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
                }
            );

        } catch (err) {
            console.error("Error during job submission:", err);
            displayError(`Error: ${err.message}`);

            // Hide spinner and countdown in case of error
            spinner.style.display = "none";
            countdownDiv.textContent = "";
            clearInterval(countdownInterval);
        } finally {
            // Reset the button
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Job";
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

// Initialize the application once the DOM is fully loaded
document.addEventListener("DOMContentLoaded", initializeApp);
