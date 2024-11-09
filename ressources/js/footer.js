// frontend/ressources/js/footer.js

import { getCookie } from './cookie.js';

/**
 * Displays the disclaimer indicator.
 */
export function showDisclaimerIndicator() {
    const disclaimerIndicator = document.getElementById("disclaimerIndicator");
    const disclaimerStatusIcon = document.getElementById("disclaimerStatusIcon");
    const disclaimerStatusText = document.getElementById("disclaimerStatusText");
    
    disclaimerIndicator.style.display = "flex"; // Show the indicator
    // Update the icon and text
    disclaimerStatusIcon.textContent = "✔️"; // Checkmark
    disclaimerStatusText.textContent = "Disclaimer";
}

/**
 * Hides the disclaimer indicator.
 */
export function hideDisclaimerIndicator() {
    const disclaimerIndicator = document.getElementById("disclaimerIndicator");
    disclaimerIndicator.style.display = "none"; // Hide the indicator
}

/**
 * Initializes the footer functionality by setting up event listeners.
 */
export function initializeFooter() {
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
    const disclaimerIndicatorBtn = document.getElementById("disclaimerIndicator");
    if (disclaimerIndicatorBtn) {
        disclaimerIndicatorBtn.addEventListener("click", () => {
            // Dispatch a custom event to reopen the disclaimer modal
            const event = new Event('reopenDisclaimerModal');
            document.dispatchEvent(event);
        });
    }
}
