// frontend/ressources/js/footer.js

import { getCookie } from './cookie.js';

/**
 * Initializes the footer functionality by setting up event listeners and generating the footer content.
 */
export function initializeFooter() {
    // Generate the footer content dynamically
    generateFooter();
    // Set the current year dynamically
    setCurrentYear();

    // Listen for the 'disclaimerAcknowledged' event to show the indicator
    document.addEventListener('disclaimerAcknowledged', showDisclaimerIndicator);

    // Initial check to show/hide the disclaimer indicator based on the cookie
    const disclaimerAcknowledged = getCookie('disclaimerAcknowledged');
    if (disclaimerAcknowledged) {
        showDisclaimerIndicator();
    } else {
        hideDisclaimerIndicator();
    }

    // Event Listener for Disclaimer Indicator Button
    const disclaimerIndicatorBtn = document.getElementById('disclaimerIndicator');
    if (disclaimerIndicatorBtn) {
        disclaimerIndicatorBtn.addEventListener('click', () => {
            // Dispatch a custom event to reopen the disclaimer modal
            const event = new Event('reopenDisclaimerModal');
            document.dispatchEvent(event);
        });
    }
}

/**
 * Displays the disclaimer indicator.
 */
export function showDisclaimerIndicator() {
    const disclaimerIndicator = document.getElementById('disclaimerIndicator');
    const disclaimerStatusIcon = document.getElementById('disclaimerStatusIcon');
    const disclaimerStatusText = document.getElementById('disclaimerStatusText');

    disclaimerIndicator.style.display = 'flex'; // Show the indicator
    // Update the icon and text
    disclaimerStatusIcon.textContent = '✔️'; // Checkmark
    disclaimerStatusText.textContent = 'Disclaimer';
}

/**
 * Hides the disclaimer indicator.
 */
export function hideDisclaimerIndicator() {
    const disclaimerIndicator = document.getElementById('disclaimerIndicator');
    disclaimerIndicator.style.display = 'none'; // Hide the indicator
}

/**
 * Dynamically generates the footer institution logos and links.
 */
function generateFooter() {
    const institutions = window.CONFIG.institutions || [];

    // Get the container elements
    const institutionLogosDiv = document.getElementById('institutionLogos');
    const footerLinksDiv = document.getElementById('footerLinks');

    // Clear existing content to avoid duplication
    institutionLogosDiv.innerHTML = '';
    footerLinksDiv.innerHTML = '';

    // Generate Institution Logos
    institutions.forEach(inst => {
        const link = document.createElement('a');
        link.href = inst.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const img = document.createElement('img');
        img.src = inst.base64; // Use Base64 string from config
        img.alt = `${inst.name} Logo`;
        img.classList.add('institution-logo', 'me-3', 'mb-3'); // Added margin for better spacing
        img.width = inst.width; // Set explicit width
        img.height = inst.height; // Set explicit height
        img.loading = 'lazy'; // Lazy load non-critical images

        // Handle load event for smooth transition
        img.addEventListener('load', () => {
            img.classList.add('logo-loaded');
        });

        link.appendChild(img);
        institutionLogosDiv.appendChild(link);
    });
}

/**
 * Sets the current year in the footer.
 */
function setCurrentYear() {
    const currentYear = new Date().getFullYear();
    const currentYearSpan = document.getElementById('currentYear');
    if (currentYearSpan) {
        currentYearSpan.textContent = currentYear;
    }
}
