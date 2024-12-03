// frontend/ressources/js/disclaimer.js

import { getCookie, setCookie } from './cookie.js';

/**
 * Initializes the disclaimer functionality by setting up event listeners and managing disclaimer display.
 */
export function initializeDisclaimer() {
    // Check if the disclaimer has been acknowledged
    const disclaimerAcknowledged = getCookie('disclaimerAcknowledged');

    if (!disclaimerAcknowledged) {
        // Show the disclaimer modal
        openDisclaimerModal();
    } else {
        // Show the disclaimer indicator
        showDisclaimerIndicator();
    }

    // Event Listener for Disclaimer Indicator Button
    const disclaimerIndicatorBtn = document.getElementById('disclaimerIndicator');
    if (disclaimerIndicatorBtn) {
        disclaimerIndicatorBtn.addEventListener('click', () => {
            // Reopen the disclaimer modal
            openDisclaimerModal();
        });
    }
}

/**
 * Opens the disclaimer modal and traps focus within it.
 */
function openDisclaimerModal() {
    const disclaimerModal = document.getElementById('disclaimerModal');
    const agreeBtn = document.getElementById('agreeBtn');
    if (disclaimerModal && agreeBtn) {
        disclaimerModal.style.display = 'block';
        document.body.classList.add('modal-open');
        // Set focus to the "I Agree" button for accessibility
        agreeBtn.focus();
        // Trap focus within the modal
        trapFocus(disclaimerModal);
    }
}

/**
 * Closes the disclaimer modal and removes focus trap.
 */
function closeDisclaimerModal() {
    const disclaimerModal = document.getElementById('disclaimerModal');
    if (disclaimerModal) {
        disclaimerModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        // Remove focus trap
        removeTrapFocus(disclaimerModal);
    }
}

/**
 * Handles the agreement to the disclaimer.
 */
function handleAgree() {
    setCookie('disclaimerAcknowledged', 'true', 365); // Cookie expires in 1 year
    closeDisclaimerModal();
    showDisclaimerIndicator();
}

/**
 * Displays the disclaimer indicator.
 */
export function showDisclaimerIndicator() {
    const disclaimerIndicator = document.getElementById('disclaimerIndicator');
    const disclaimerStatusIcon = document.getElementById('disclaimerStatusIcon');
    const disclaimerStatusText = document.getElementById('disclaimerStatusText');

    if (disclaimerIndicator) {
        disclaimerIndicator.style.display = 'flex'; // Show the indicator
    }
    if (disclaimerStatusIcon) {
        disclaimerStatusIcon.textContent = '✔️'; // Checkmark
    }
    if (disclaimerStatusText) {
        disclaimerStatusText.textContent = 'Disclaimer';
    }
}

/**
 * Hides the disclaimer indicator.
 */
export function hideDisclaimerIndicator() {
    const disclaimerIndicator = document.getElementById('disclaimerIndicator');
    if (disclaimerIndicator) {
        disclaimerIndicator.style.display = 'none'; // Hide the indicator
    }
}

/**
 * Trap focus within a given element for accessibility.
 * @param {HTMLElement} element - The element to trap focus within.
 */
function trapFocus(element) {
    const focusableElements = element.querySelectorAll('a[href], button:not([disabled]), textarea, input, select');
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    function handleFocus(event) {
        if (event.key === 'Tab') {
            if (event.shiftKey) { // Shift + Tab
                if (document.activeElement === firstFocusable) {
                    event.preventDefault();
                    lastFocusable.focus();
                }
            } else { // Tab
                if (document.activeElement === lastFocusable) {
                    event.preventDefault();
                    firstFocusable.focus();
                }
            }
        } else if (event.key === 'Escape') {
            // Prevent closing the modal with Escape
            event.preventDefault();
        }
    }

    element.addEventListener('keydown', handleFocus);
    // Save the handler so it can be removed later
    element.focusHandler = handleFocus;
}

/**
 * Removes the focus trap from the modal.
 * @param {HTMLElement} element - The modal element.
 */
function removeTrapFocus(element) {
    if (element.focusHandler) {
        element.removeEventListener('keydown', element.focusHandler);
        delete element.focusHandler;
    }
}

/**
 * Initializes event listeners for the disclaimer modal.
 */
function initializeDisclaimerModal() {
    // Agree button event listener
    const agreeBtn = document.getElementById('agreeBtn');
    if (agreeBtn) {
        agreeBtn.addEventListener('click', handleAgree);
    }

    // Close modal when clicking outside of it
    const disclaimerModal = document.getElementById('disclaimerModal');
    if (disclaimerModal) {
        disclaimerModal.addEventListener('click', (event) => {
            if (event.target === disclaimerModal) {
                // Optionally, do nothing to force user to agree
                // Or uncomment the following line to allow closing the modal
                // closeDisclaimerModal();
            }
        });
    }
}

// Initialize the disclaimer when the module is loaded
initializeDisclaimer();
initializeDisclaimerModal();
