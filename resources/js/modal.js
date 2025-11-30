// frontend/resources/js/modal.js

import { getCookie, setCookie } from './cookie.js';
import { showDisclaimerIndicator } from './disclaimer.js'; // If needed

/**
 * Opens the disclaimer modal and traps focus within it.
 */
export function openDisclaimerModal() {
  const disclaimerModal = document.getElementById('disclaimerModal');
  const agreeBtn = document.getElementById('agreeBtn');
  if (disclaimerModal && agreeBtn) {
    // Set aria-hidden FIRST before any display/focus operations
    disclaimerModal.setAttribute('aria-hidden', 'false');
    disclaimerModal.style.display = 'block';
    document.body.classList.add('modal-open');

    // Use requestAnimationFrame to ensure DOM updates are complete before focusing
    // This prevents the "aria-hidden on focused element" accessibility warning
    requestAnimationFrame(() => {
      // Set focus to the "I Agree" button for accessibility
      agreeBtn.focus();
      // Trap focus within the modal - Escape disabled for disclaimer
      trapFocus(disclaimerModal, false);
    });
  }
}

/**
 * Closes the disclaimer modal and removes focus trap.
 */
export function closeDisclaimerModal() {
  const disclaimerModal = document.getElementById('disclaimerModal');
  if (disclaimerModal) {
    disclaimerModal.style.display = 'none';
    disclaimerModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    // Remove focus trap and return focus
    removeTrapFocus(disclaimerModal);
  }
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
 * Trap focus within a given element for accessibility (ARIA best practices).
 * @param {HTMLElement} element - The element to trap focus within.
 * @param {boolean} allowEscape - Whether Escape key should close the modal (default: true).
 */
function trapFocus(element, allowEscape = true) {
  const focusableElements = element.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  // Store element that had focus before modal opened
  element.previousFocus = document.activeElement;

  function handleFocus(event) {
    if (event.key === 'Tab') {
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
    } else if (event.key === 'Escape' && allowEscape) {
      // Close modal and return focus
      const closeEvent = new CustomEvent('modal:close', { detail: { modal: element } });
      element.dispatchEvent(closeEvent);
    }
  }

  element.addEventListener('keydown', handleFocus);
  // Save the handler so it can be removed later
  element.focusHandler = handleFocus;
}

/**
 * Removes the focus trap from the modal and returns focus to trigger element.
 * @param {HTMLElement} element - The modal element.
 */
function removeTrapFocus(element) {
  if (element.focusHandler) {
    element.removeEventListener('keydown', element.focusHandler);
    delete element.focusHandler;
  }

  // Return focus to element that opened the modal
  if (element.previousFocus && element.previousFocus.focus) {
    element.previousFocus.focus();
    delete element.previousFocus;
  }
}

/**
 * Opens the FAQ modal and traps focus within it.
 */
function openFaqModal() {
  const faqModal = document.getElementById('faqModal');
  if (faqModal) {
    // Set aria-hidden FIRST before any display/focus operations
    faqModal.setAttribute('aria-hidden', 'false');
    faqModal.style.display = 'block';
    document.body.classList.add('modal-open');

    // Use requestAnimationFrame to ensure DOM updates are complete before focusing
    // This prevents the "aria-hidden on focused element" accessibility warning
    requestAnimationFrame(() => {
      const closeButton = faqModal.querySelector('.modal-close');
      if (closeButton) {
        closeButton.focus();
      }

      // Trap focus within the modal - Escape enabled for FAQ
      trapFocus(faqModal, true);

      // Listen for custom close event from Escape key
      faqModal.addEventListener('modal:close', () => closeFaqModal(), { once: true });
    });
  }
}

/**
 * Closes the FAQ modal and removes focus trap.
 */
function closeFaqModal() {
  const faqModal = document.getElementById('faqModal');
  if (faqModal) {
    faqModal.style.display = 'none';
    faqModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    // Remove focus trap and return focus to trigger
    removeTrapFocus(faqModal);
  }
}

/**
 * Initializes the modal functionality by setting up event listeners.
 */
export function initializeModal() {
  // Handle Disclaimer Modal
  const agreeBtn = document.getElementById('agreeBtn');
  if (agreeBtn) {
    agreeBtn.addEventListener('click', handleAgree);
  }

  // Handle Close Button in Disclaimer Modal (same as agree)
  const disclaimerModal = document.getElementById('disclaimerModal');
  const disclaimerCloseButton = disclaimerModal
    ? disclaimerModal.querySelector('.modal-close')
    : null;
  if (disclaimerCloseButton) {
    disclaimerCloseButton.addEventListener('click', () => {
      handleAgree();
    });
  }

  // Handle Overlay Click in Disclaimer Modal (same as agree)
  const disclaimerOverlay = disclaimerModal
    ? disclaimerModal.querySelector('.modal-overlay')
    : null;
  if (disclaimerOverlay) {
    disclaimerOverlay.addEventListener('click', () => {
      handleAgree();
    });
  }

  // Listen for the 'reopenDisclaimerModal' event to reopen the modal
  document.addEventListener('reopenDisclaimerModal', openDisclaimerModal);

  // Handle FAQ Modal
  const faqLinks = document.querySelectorAll('a[data-modal="faqModal"]');
  const faqModal = document.getElementById('faqModal');
  const faqCloseButton = faqModal ? faqModal.querySelector('.modal-close') : null;
  const faqOverlay = faqModal ? faqModal.querySelector('.modal-overlay') : null;

  faqLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      openFaqModal();
    });
  });

  // Handle Close Button in FAQ Modal
  if (faqCloseButton) {
    faqCloseButton.addEventListener('click', () => {
      closeFaqModal();
    });
  }

  // Handle Overlay Click in FAQ Modal
  if (faqOverlay) {
    faqOverlay.addEventListener('click', () => {
      closeFaqModal();
    });
  }

  // Optionally, open Disclaimer Modal on page load if not acknowledged
  if (!getCookie('disclaimerAcknowledged')) {
    openDisclaimerModal();
  }
}

// Initialize modals when the script is loaded
initializeModal();
