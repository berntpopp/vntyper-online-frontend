// frontend/ressources/js/uiUtils.js

import { logMessage } from './log.js'; // Import the logMessage function

let countdownInterval = null;
let timeLeft = 20; // Countdown time in seconds

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
                logMessage(`Countdown updated: ${timeLeft} seconds remaining.`, 'info');
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
export function initializeToggleOptionalInputs() {
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
