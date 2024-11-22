// frontend/ressources/js/uiUtils.js

let countdownInterval = null;
let timeLeft = 20; // Countdown time in seconds

export function showSpinner() {
    const spinner = document.getElementById('spinner');
    spinner.classList.remove('hidden');
    spinner.classList.add('visible');
}

export function hideSpinner() {
    const spinner = document.getElementById('spinner');
    spinner.classList.remove('visible');
    spinner.classList.add('hidden');
}

export function startCountdown() {
    const countdownDiv = document.getElementById('countdown');
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

export function resetCountdown() {
    timeLeft = 20;
    const countdownDiv = document.getElementById('countdown');
    countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
}

export function clearCountdown() {
    const countdownDiv = document.getElementById('countdown');
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        countdownDiv.textContent = '';
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
        console.warn('Toggle button or additional inputs container not found.');
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
        } else {
            // Hide optional inputs
            additionalInputs.classList.remove('visible');
            additionalInputs.classList.add('hidden');
            toggleButton.textContent = 'Show options';
            toggleButton.setAttribute('aria-expanded', 'false');
        }
    });
}

/* --- Initialize All UI Utilities --- */

/**
 * Initializes all UI utilities by calling their respective initialization functions.
 * This function should be called once the DOM is fully loaded.
 */
export function initializeUIUtils() {
    initializeToggleOptionalInputs();
    // Add other UI utilities initialization here if needed in the future
}
