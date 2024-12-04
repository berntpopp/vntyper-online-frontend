// frontend/resources/js/uiUtils.js

import { logMessage } from './log.js'; // Import the logMessage function

let countdownInterval = null;
let timeLeft = 20; // Countdown time in seconds

/**
 * Shows the placeholder message in the output area.
 */
export function showPlaceholderMessage() { // Exported
    const placeholderMessage = document.getElementById('placeholderMessage');
    if (placeholderMessage) {
        placeholderMessage.classList.remove('hidden');
        logMessage('Placeholder message displayed.', 'info');
    } else {
        logMessage('Placeholder message div (#placeholderMessage) not found in the DOM.', 'warning');
    }
}

/**
 * Hides the placeholder message in the output area.
 */
export function hidePlaceholderMessage() { // Exported
    const placeholderMessage = document.getElementById('placeholderMessage');
    if (placeholderMessage) {
        placeholderMessage.classList.add('hidden');
        logMessage('Placeholder message hidden.', 'info');
    } else {
        logMessage('Placeholder message div (#placeholderMessage) not found in the DOM.', 'warning');
    }
}

/**
 * Displays a message to the user in the output area.
 * @param {string} message - The message to display.
 * @param {string} type - The type of message ('info', 'error', 'success').
 */
export function displayMessage(message, type = 'info') {
    hidePlaceholderMessage(); // Hide placeholder when displaying a message
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.innerHTML = message;
        messageDiv.className = ''; // Reset classes
        messageDiv.classList.add('message', `message-${type}`);
        messageDiv.classList.remove('hidden');
        logMessage(`Displayed message: "${message}" with type "${type}".`, 'info');
    } else {
        logMessage('Message div (#message) not found in the DOM.', 'warning');
    }
}

/**
 * Clears the displayed message.
 */
export function clearMessage() {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.innerHTML = '';
        messageDiv.className = ''; // Reset classes
        messageDiv.classList.add('message', 'hidden');
        logMessage('Cleared message display.', 'info');
    }
    showPlaceholderMessage(); // Show placeholder when message is cleared
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
 * Displays the shareable link to the user within the specified container.
 * Includes a copy link button next to it.
 * @param {string} jobId - The job identifier.
 * @param {HTMLElement} targetContainer - The DOM element where the link should be appended.
 */
export function displayShareableLink(jobId, targetContainer) { // Updated to accept targetContainer
    hidePlaceholderMessage(); // Hide placeholder when displaying shareable link

    if (!targetContainer) {
        logMessage('Target container not provided for shareable link.', 'warning');
        return;
    }

    // Avoid duplicating the shareable link if it already exists
    if (document.getElementById(`shareContainer-${jobId}`)) {
        logMessage(`Shareable link for Job ID ${jobId} already exists.`, 'info');
        return;
    }

    const shareContainer = document.createElement('div');
    shareContainer.id = `shareContainer-${jobId}`; // Unique ID to prevent duplicates
    shareContainer.classList.add('share-container', 'mt-2');

    const shareLabel = document.createElement('span');
    shareLabel.textContent = 'Shareable Link: ';
    shareContainer.appendChild(shareLabel);

    const shareLink = document.createElement('input');
    shareLink.type = 'text';
    shareLink.value = generateShareableLink(jobId);
    shareLink.readOnly = true;
    shareLink.classList.add('share-link-input');
    shareLink.setAttribute('aria-label', `Shareable link for Job ID ${jobId}`);

    // Add copy button
    const copyButton = document.createElement('button');
    copyButton.classList.add('copy-button');
    copyButton.setAttribute('aria-label', 'Copy link');
    copyButton.innerHTML = '📋'; // Using clipboard emoji as copy icon

    // Event listener for copy functionality
    copyButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(shareLink.value);
            copyButton.innerHTML = '✅'; // Change icon to indicate success
            logMessage(`Shareable link for Job ID ${jobId} copied to clipboard.`, 'info');

            // Revert the icon back after 2 seconds
            setTimeout(() => {
                copyButton.innerHTML = '📋';
            }, 2000);
        } catch (err) {
            logMessage(`Failed to copy shareable link for Job ID ${jobId}: ${err.message}`, 'error');
            alert('Failed to copy the link. Please try manually.');
        }
    });

    shareContainer.appendChild(shareLink);
    shareContainer.appendChild(copyButton);

    // Append to target container
    targetContainer.appendChild(shareContainer);
    logMessage(`Shareable link generated for Job ID ${jobId}.`, 'info');
}

/**
 * Displays the loading spinner in the UI.
 */
export function showSpinner() {
    const spinner = document.getElementById('spinner');
    if (spinner) {
        spinner.classList.remove('hidden');
        spinner.classList.add('visible');
        logMessage('Spinner displayed.', 'info');
    } else {
        logMessage('Spinner element (#spinner) not found in the DOM.', 'warning');
    }
}

/**
 * Hides the loading spinner in the UI.
 */
export function hideSpinner() {
    const spinner = document.getElementById('spinner');
    if (spinner) {
        spinner.classList.remove('visible');
        spinner.classList.add('hidden');
        logMessage('Spinner hidden.', 'info');
    } else {
        logMessage('Spinner element (#spinner) not found in the DOM.', 'warning');
    }
}

/**
 * Starts a countdown timer that updates the UI every second.
 */
export function startCountdown() {
    const countdownDiv = document.getElementById('countdown');
    if (countdownDiv) {
        countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
        logMessage(`Countdown started with ${timeLeft} seconds.`, 'info');

        countdownInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
            } else {
                timeLeft = 20;
                countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
                logMessage('Countdown reset to 20 seconds.', 'info');
            }
        }, 1000);
    } else {
        logMessage('Countdown element (#countdown) not found in the DOM.', 'warning');
    }
}

/**
 * Resets the countdown timer to the initial value.
 */
export function resetCountdown() {
    timeLeft = 20;
    const countdownDiv = document.getElementById('countdown');
    if (countdownDiv) {
        countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
        logMessage('Countdown reset manually to 20 seconds.', 'info');
    } else {
        logMessage('Countdown element (#countdown) not found in the DOM.', 'warning');
    }
}

/**
 * Clears the countdown timer and removes its display from the UI.
 */
export function clearCountdown() {
    const countdownDiv = document.getElementById('countdown');
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        logMessage('Countdown interval cleared.', 'info');
    }

    if (countdownDiv) {
        countdownDiv.textContent = '';
        logMessage('Countdown display cleared from UI.', 'info');
    } else {
        logMessage('Countdown element (#countdown) not found in the DOM.', 'warning');
    }
}

/* --- Toggle Optional Inputs Functionality --- */

/**
 * Initializes the toggle functionality for optional inputs (Email and Cohort Alias).
 * This function adds an event listener to the toggle button to show/hide the optional inputs.
 */
function initializeToggleOptionalInputs() {
    const toggleButton = document.getElementById('toggleOptionalInputs');
    const additionalInputs = document.getElementById('additionalInputs');

    if (!toggleButton || !additionalInputs) {
        logMessage('Toggle button (#toggleOptionalInputs) or additional inputs container (#additionalInputs) not found in the DOM.', 'warning');
        return;
    }

    toggleButton.addEventListener('click', () => {
        const isHidden = additionalInputs.classList.contains('hidden');

        if (isHidden) {
            // Show optional inputs
            additionalInputs.classList.remove('hidden');
            additionalInputs.classList.add('visible');
            toggleButton.textContent = 'Hide options';
            toggleButton.setAttribute('aria-expanded', 'true');
            logMessage('Optional inputs displayed.', 'info');
        } else {
            // Hide optional inputs
            additionalInputs.classList.remove('visible');
            additionalInputs.classList.add('hidden');
            toggleButton.textContent = 'Show options';
            toggleButton.setAttribute('aria-expanded', 'false');
            logMessage('Optional inputs hidden.', 'info');
        }
    });

    logMessage('Toggle functionality for optional inputs initialized.', 'info');
}

/* --- Initialize All UI Utilities --- */

/**
 * Initializes all UI utilities by calling their respective initialization functions.
 * This function should be called once the DOM is fully loaded.
 */
export function initializeUIUtils() {
    logMessage('Initializing UI utilities...', 'info');
    initializeToggleOptionalInputs();
    logMessage('UI utilities initialized.', 'info');
    // Add other UI utilities initialization here if needed in the future
}
