// frontend/ressources/js/version.js

import { logMessage } from './log.js'; // Import the logMessage function

// Frontend Version
const frontendVersion = '0.27.4'; // Update this as needed

// API Endpoint for Versions
const versionEndpoint = `${window.CONFIG.API_URL}/version/`;

/**
 * Fetches and displays version information.
 * Updates the UI with frontend, API, and tool versions.
 */
async function displayVersions() {
    // Display Frontend Version
    const frontendVersionElement = document.getElementById('appVersion');
    if (frontendVersionElement) {
        frontendVersionElement.textContent = frontendVersion;
        logMessage(`Frontend version set to ${frontendVersion}.`, 'info');
    } else {
        logMessage('Frontend version element (#appVersion) not found.', 'warning');
    }

    // Fetch Tool Version from Backend
    try {
        logMessage(`Fetching versions from API endpoint: ${versionEndpoint}`, 'info');
        const response = await fetch(versionEndpoint);
        if (!response.ok) {
            throw new Error(`Failed to fetch versions: ${response.statusText}`);
        }
        const data = await response.json();
        const { api_version, tool_version } = data;

        // Display API Version
        const apiVersionElement = document.getElementById('apiVersion');
        if (apiVersionElement) {
            apiVersionElement.textContent = api_version;
            logMessage(`API version set to ${api_version}.`, 'info');
        } else {
            logMessage('API version element (#apiVersion) not found.', 'warning');
        }

        // Display Tool Version
        const toolVersionElement = document.getElementById('toolVersion');
        if (toolVersionElement) {
            toolVersionElement.textContent = tool_version;
            logMessage(`Tool version set to ${tool_version}.`, 'info');
        } else {
            logMessage('Tool version element (#toolVersion) not found.', 'warning');
        }

        logMessage('Version information fetched and displayed successfully.', 'success');
    } catch (error) {
        logMessage(`Error fetching versions: ${error.message}`, 'error');
        
        // Optionally display an error message to the user
        const apiVersionElement = document.getElementById('apiVersion');
        if (apiVersionElement) {
            apiVersionElement.textContent = 'N/A';
            logMessage('API version set to N/A due to fetch error.', 'warning');
        }

        const toolVersionElement = document.getElementById('toolVersion');
        if (toolVersionElement) {
            toolVersionElement.textContent = 'N/A';
            logMessage('Tool version set to N/A due to fetch error.', 'warning');
        }
    }
}

/**
 * Displays the current year in the footer.
 */
function displayCurrentYear() {
    const currentYearElement = document.getElementById('currentYear');
    if (currentYearElement) {
        const currentYear = new Date().getFullYear();
        currentYearElement.textContent = currentYear;
        logMessage(`Current year set to ${currentYear}.`, 'info');
    } else {
        logMessage('Current year element (#currentYear) not found.', 'warning');
    }
}

// Display Current Year and Versions on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    logMessage('DOM fully loaded and parsed. Initializing version information.', 'info');
    
    // Display Current Year
    displayCurrentYear();

    // Display Versions
    displayVersions();
});
