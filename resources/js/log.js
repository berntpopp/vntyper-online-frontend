// frontend/resources/js/log.js

/**
 * Logs a message to the in-UI logging panel.
 * @param {string} message - The message to log.
 * @param {string} level - The log level ('info', 'warning', 'error', 'success').
 */
export function logMessage(message, level = 'info') {
    const logContent = document.getElementById('logContent');
    if (!logContent) return;

    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry', `log-${level}`);

    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `<strong>[${timestamp}] [${capitalizeFirstLetter(level)}]</strong> ${message}`;

    logContent.appendChild(logEntry);

    // Remove oldest log if exceeding 100 entries
    if (logContent.children.length > 100) {
        logContent.removeChild(logContent.firstChild);
    }

    // Scroll to the bottom to show the latest log
    logContent.scrollTo({
        top: logContent.scrollHeight,
        behavior: 'smooth' // Smooth scroll
    });
}

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
 * Initializes the logging system by setting up event listeners for the toggle, close, and clear buttons.
 */
export function initializeLogging() {
    const toggleLogBtn = document.getElementById('toggleLogBtn');
    const logContainer = document.getElementById('logContainer');
    const closeLogBtn = logContainer.querySelector('.close-log-btn');
    const clearLogBtn = logContainer.querySelector('.clear-log-btn');

    // Load visibility preference
    const isVisible = localStorage.getItem('logContainerVisible') === 'true';
    if (isVisible) {
        logContainer.classList.add('visible');
        logContainer.classList.remove('hidden');
        toggleLogBtn.setAttribute('aria-expanded', 'true');
    } else {
        logContainer.classList.add('hidden');
        logContainer.classList.remove('visible');
        toggleLogBtn.setAttribute('aria-expanded', 'false');
    }

    // Toggle Logs Panel Visibility
    toggleLogBtn.addEventListener('click', () => {
        const currentlyVisible = logContainer.classList.contains('visible');
        logContainer.classList.toggle('visible');
        logContainer.classList.toggle('hidden');
        toggleLogBtn.setAttribute('aria-expanded', !currentlyVisible);
        localStorage.setItem('logContainerVisible', !currentlyVisible);
        logMessage(`Logging panel ${!currentlyVisible ? 'opened' : 'closed'}.`, 'info');
    });

    // Close Logs Panel
    closeLogBtn.addEventListener('click', () => {
        logContainer.classList.add('hidden');
        logContainer.classList.remove('visible');
        toggleLogBtn.setAttribute('aria-expanded', 'false');
        localStorage.setItem('logContainerVisible', 'false');
        logMessage('Logging panel closed.', 'info');
    });

    // Clear Logs
    clearLogBtn.addEventListener('click', () => {
        const logContent = document.getElementById('logContent');
        logContent.innerHTML = ''; // Clear all log entries
        logMessage('All logs have been cleared.', 'info');
    });

    logMessage('Logging system initialized.', 'info');
}
