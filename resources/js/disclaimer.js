// frontend/resources/js/disclaimer.js

import { getCookie, setCookie } from './cookie.js';

/**
 * Initializes the disclaimer functionality by setting up event listeners and managing disclaimer display.
 */
export function initializeDisclaimer() {
  // Wire the modal's own listeners. This used to run at import time; it is
  // called from here so main.js remains the single initialization path.
  initializeDisclaimerModal();

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
    disclaimerStatusIcon.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
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
 * A modal element carrying the keydown handler the focus trap stores on it as
 * an expando property so that it can be detached again later.
 *
 * @typedef {HTMLElement & { focusHandler?: EventListener }} FocusTrapElement
 */

/**
 * Trap focus within a given element for accessibility.
 * @param {FocusTrapElement} element - The element to trap focus within.
 */
function trapFocus(element) {
  const focusableElements = /** @type {NodeListOf<HTMLElement>} */ (
    element.querySelectorAll('a[href], button:not([disabled]), textarea, input, select')
  );
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  function handleFocus(event) {
    if (event.key === 'Tab') {
      // A modal with no focusable children leaves first/last undefined - there
      // is nothing to cycle between, so let the browser handle Tab itself.
      if (!firstFocusable || !lastFocusable) {
        return;
      }
      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab
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
 * @param {FocusTrapElement} element - The modal element.
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
    disclaimerModal.addEventListener('click', event => {
      if (event.target === disclaimerModal) {
        // Optionally, do nothing to force user to agree
        // Or uncomment the following line to allow closing the modal
        // closeDisclaimerModal();
      }
    });
  }
}

// No import-time initialization - main.js calls initializeDisclaimer(), which
// now wires the modal too. Self-initializing here registered every listener a
// second time on top of main.js's call. See the note in modal.js.
