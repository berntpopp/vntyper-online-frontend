// frontend/resources/js/navbar.js

import { logMessage } from './log.js';

/**
 * Configure dynamic navbar elements based on runtime configuration.
 */
export function initializeNavbar() {
  const apiDocsLink = /** @type {HTMLAnchorElement | null} */ (
    document.getElementById('apiDocsLink')
  );
  if (!apiDocsLink) {
    return;
  }

  const docsUrl = window.CONFIG?.API_DOCS_URL || `${window.CONFIG?.API_URL || '/api'}/docs`;
  apiDocsLink.href = docsUrl;
  logMessage(`Navbar API docs link configured to: ${docsUrl}`, 'debug');
}
