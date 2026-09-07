// frontend/resources/js/version.js

import { logMessage } from './log.js'; // Import the logMessage function

// Frontend Version
const frontendVersion = '0.71.3'; // Remove outdated adVNTR processing time estimate

/**
 * Build the API version endpoint, or null when this page has no API config.
 *
 * Only index.html loads config.js. Reading window.CONFIG at module scope threw
 * during evaluation on contact.html, both imprints and adtkd_diagnostics.html,
 * which prevented the DOMContentLoaded handler below from ever registering -
 * so the copyright year was blank on 4 of 5 pages.
 *
 * @returns {string|null} The versions endpoint, or null when unavailable.
 */
function getVersionEndpoint() {
  const apiUrl = window.CONFIG?.API_URL;
  return apiUrl ? `${apiUrl}/version/` : null;
}

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

  // Pages without config.js have no API to ask; the frontend version above is
  // still rendered, and API/tool versions stay at their markup defaults.
  const versionEndpoint = getVersionEndpoint();
  if (!versionEndpoint) {
    logMessage('No API configuration on this page; skipping version fetch.', 'info');
    return;
  }

  // Fetch Tool Version from Backend
  try {
    logMessage(`Fetching versions from API endpoint: ${versionEndpoint}`, 'debug');
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
    // Silent failure for local development (backend not running)
    logMessage(`Backend API not available (local mode): ${error.message}`, 'debug');

    // Set to N/A silently
    const apiVersionElement = document.getElementById('apiVersion');
    if (apiVersionElement) {
      apiVersionElement.textContent = 'N/A';
    }

    const toolVersionElement = document.getElementById('toolVersion');
    if (toolVersionElement) {
      toolVersionElement.textContent = 'N/A';
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
    currentYearElement.textContent = String(currentYear);
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
