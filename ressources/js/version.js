// ressources/js/version.js

// Frontend Version
const frontendVersion = '0.10.1'; // Update this as needed

// API Endpoint for Versions
const versionEndpoint = '/api/version'; // Adjust the path if necessary

// Function to Fetch and Display Versions
async function displayVersions() {
    // Display Frontend Version
    const frontendVersionElement = document.getElementById('appVersion');
    if (frontendVersionElement) {
        frontendVersionElement.textContent = frontendVersion;
    }

    // Fetch Tool Version from Backend
    try {
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
        }

        // Display Tool Version
        const toolVersionElement = document.getElementById('toolVersion');
        if (toolVersionElement) {
            toolVersionElement.textContent = tool_version;
        }
    } catch (error) {
        console.error('Error fetching versions:', error);
        // Optionally display an error message to the user
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

// Display Current Year and Versions on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Display Current Year
    const currentYearElement = document.getElementById('currentYear');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }

    // Display Versions
    displayVersions();
});
