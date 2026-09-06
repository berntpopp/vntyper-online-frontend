// frontend/resources/js/disclaimer.js

import { getCookie } from './cookie.js';

/**
 * Displays the disclaimer indicator in the navbar.
 */
export function showDisclaimerIndicator() {
  const disclaimerIndicator = document.getElementById('disclaimerIndicator');
  const disclaimerStatusIcon = document.getElementById('disclaimerStatusIcon');
  const disclaimerStatusText = document.getElementById('disclaimerStatusText');

  if (disclaimerIndicator) {
    disclaimerIndicator.style.display = 'flex';
  }
  if (disclaimerStatusIcon) {
    disclaimerStatusIcon.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
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
    disclaimerIndicator.style.display = 'none';
  }
}

/**
 * Initializes the disclaimer functionality.
 * Modal wiring and cookie verification are managed by modal.js.
 * Here we wire the disclaimer indicator in the navbar to reopen the modal when clicked.
 */
export function initializeDisclaimer() {
  const disclaimerAcknowledged = getCookie('disclaimerAcknowledged');

  if (disclaimerAcknowledged) {
    showDisclaimerIndicator();
  }

  const disclaimerIndicatorBtn = document.getElementById('disclaimerIndicator');
  if (disclaimerIndicatorBtn) {
    disclaimerIndicatorBtn.addEventListener('click', e => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('reopenDisclaimerModal'));
    });
  }
}
