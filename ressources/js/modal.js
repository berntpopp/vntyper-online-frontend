// frontend/ressources/js/modal.js

import { getCookie, setCookie } from './cookie.js';
import { showDisclaimerIndicator } from './footer.js'; // If needed

/**
 * Opens the disclaimer modal and traps focus within it.
 */
export function openDisclaimerModal() {
    const disclaimerModal = document.getElementById("disclaimerModal");
    const agreeBtn = document.getElementById("agreeBtn");
    disclaimerModal.style.display = "block";
    document.body.classList.add('modal-open');
    // Set focus to the "I Agree" button for accessibility
    agreeBtn.focus();
    // Trap focus within the modal
    trapFocus(disclaimerModal);
}

/**
 * Closes the disclaimer modal and removes focus trap.
 */
export function closeDisclaimerModal() {
    const disclaimerModal = document.getElementById("disclaimerModal");
    disclaimerModal.style.display = "none";
    document.body.classList.remove('modal-open');
    // Remove focus trap
    removeTrapFocus(disclaimerModal);
}

/**
 * Handles the agreement to the disclaimer.
 */
export function handleAgree() {
    setCookie('disclaimerAcknowledged', 'true', 365); // Cookie expires in 1 year
    closeDisclaimerModal();
    showDisclaimerIndicator();
}

/**
 * Checks if the disclaimer has been acknowledged and displays the modal or dispatches an event accordingly.
 */
export function checkAndShowDisclaimer() {
    const disclaimerAcknowledged = getCookie('disclaimerAcknowledged');
    if (!disclaimerAcknowledged) {
        openDisclaimerModal();
    } else {
        showDisclaimerIndicator();
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
 * Initializes the modal functionality by setting up event listeners.
 */
export function initializeModal() {
    const agreeBtn = document.getElementById("agreeBtn");
    agreeBtn.addEventListener("click", handleAgree);

    // Listen for the 'reopenDisclaimerModal' event to reopen the modal
    document.addEventListener('reopenDisclaimerModal', openDisclaimerModal);
}
