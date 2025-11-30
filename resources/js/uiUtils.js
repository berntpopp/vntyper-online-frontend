// frontend/resources/js/uiUtils.js

import { logMessage } from './log.js';
import { stateManager } from './stateManager.js';
import { initializeValidation, clearAllValidation } from './inputValidation.js';

/**
 * Shows the placeholder message in the output area.
 */
export function showPlaceholderMessage() {
  const placeholderMessage = document.getElementById('placeholderMessage');
  if (placeholderMessage) {
    placeholderMessage.classList.remove('hidden');
    placeholderMessage.classList.add('visible');
    logMessage('Placeholder message displayed.', 'info');
  } else {
    logMessage('Placeholder message div (#placeholderMessage) not found in the DOM.', 'warning');
  }
}

/**
 * Hides the placeholder message in the output area.
 */
export function hidePlaceholderMessage() {
  const placeholderMessage = document.getElementById('placeholderMessage');
  if (placeholderMessage) {
    placeholderMessage.classList.remove('visible');
    placeholderMessage.classList.add('hidden');
    logMessage('Placeholder message hidden.', 'info');
  } else {
    logMessage('Placeholder message div (#placeholderMessage) not found in the DOM.', 'warning');
  }
}

/**
 * Displays a message to the user in the output area.
 * @param {string} message - The message to display.
 * @param {string} type - The type of message ('info', 'error', 'success').
 */
export function displayMessage(message, type = 'info') {
  const messageDiv = document.getElementById('message');

  // Validate message is not empty
  if (!message || (typeof message === 'string' && message.trim() === '')) {
    logMessage(
      `⚠️ displayMessage called with empty message (type: ${type}). Current stack:`,
      'warning'
    );
    console.trace('Empty message trace');
    // Clear message div if it exists
    if (messageDiv) {
      clearMessage();
    }
    return;
  }

  hidePlaceholderMessage(); // Hide placeholder when displaying a message

  if (messageDiv) {
    // XSS-safe: Use textContent instead of innerHTML
    messageDiv.textContent = message;
    messageDiv.className = ''; // Reset classes
    messageDiv.classList.add('message', `message-${type}`);
    messageDiv.classList.remove('hidden');
    logMessage(`Displayed message: "${message}" with type "${type}".`, 'info');
  } else {
    logMessage('Message div (#message) not found in the DOM.', 'warning');
  }
}

/**
 * Appends a warning message to existing content without overwriting it.
 * @param {string} message - The warning message to append.
 */
export function appendWarningMessage(message) {
  // Validate message is not empty
  if (!message || (typeof message === 'string' && message.trim() === '')) {
    logMessage('appendWarningMessage called with empty message. Skipping append.', 'warning');
    return;
  }

  hidePlaceholderMessage(); // Hide placeholder when displaying a message
  const messageDiv = document.getElementById('message');
  if (messageDiv) {
    // XSS-safe: Use DOM API to append content
    if (messageDiv.textContent) {
      // Add line breaks if there's existing content
      messageDiv.appendChild(document.createElement('br'));
      messageDiv.appendChild(document.createElement('br'));
    }
    messageDiv.appendChild(document.createTextNode(message));

    // Ensure warning class is applied (keep existing classes but ensure warning is included)
    if (!messageDiv.classList.contains('message-warning')) {
      messageDiv.classList.add('message-warning');
    }
    messageDiv.classList.remove('hidden');
    logMessage(`Appended warning message: "${message}".`, 'info');
  } else {
    logMessage('Message div (#message) not found in the DOM.', 'warning');
  }
}

/**
 * Clears the displayed message.
 */
export function clearMessage() {
  const messageDiv = document.getElementById('message');
  if (messageDiv) {
    logMessage(
      `clearMessage called. Before: classes="${messageDiv.className}", content="${messageDiv.textContent}"`,
      'info'
    );
    messageDiv.innerHTML = '';
    messageDiv.className = ''; // Reset classes
    messageDiv.classList.add('message', 'hidden');
    logMessage(
      `clearMessage complete. After: classes="${messageDiv.className}", hidden=${messageDiv.classList.contains('hidden')}`,
      'info'
    );
  }
  showPlaceholderMessage(); // Show placeholder when message is cleared
}

/**
 * Generates a shareable URL containing the job or cohort ID.
 * @param {string} id - The job or cohort identifier.
 * @param {string} type - The type of identifier ('job' or 'cohort').
 * @returns {string} - The shareable URL.
 */
function generateShareableLink(id, type) {
  const url = new URL(window.location.href);
  if (type === 'cohort') {
    url.searchParams.set('cohort_id', id);
  } else {
    url.searchParams.set('job_id', id);
  }
  return url.toString();
}

/**
 * Displays the shareable link to the user within the specified container.
 * Includes a copy link button next to it.
 * @param {string} id - The job or cohort identifier.
 * @param {HTMLElement} targetContainer - The DOM element where the link should be appended.
 * @param {string} type - The type of identifier ('job' or 'cohort').
 */
export function displayShareableLink(id, targetContainer, type = 'job') {
  hidePlaceholderMessage(); // Hide placeholder when displaying shareable link

  // Enhanced validation for 'id'
  if (typeof id !== 'string' || id.trim() === '') {
    logMessage(
      'Invalid ID provided to displayShareableLink: undefined, null, or empty string.',
      'error'
    );
    return;
  }

  if (!['job', 'cohort'].includes(type)) {
    logMessage(
      `Unknown type "${type}" provided to displayShareableLink. Expected 'job' or 'cohort'.`,
      'error'
    );
    return;
  }

  if (!(targetContainer instanceof HTMLElement)) {
    logMessage(
      'Target container provided to displayShareableLink is not a valid DOM element.',
      'error'
    );
    return;
  }

  // Avoid duplicating the shareable link if it already exists
  if (document.getElementById(`shareContainer-${type}-${id}`)) {
    logMessage(`Shareable link for ${type} ID ${id} already exists. Skipping creation.`, 'info');
    return;
  }

  const shareContainer = document.createElement('div');
  shareContainer.id = `shareContainer-${type}-${id}`; // Unique ID to prevent duplicates
  shareContainer.classList.add('share-container', 'mt-2');

  const shareLabel = document.createElement('span');
  shareLabel.textContent = 'Shareable Link: ';
  shareContainer.appendChild(shareLabel);

  const shareLink = document.createElement('input');
  shareLink.type = 'text';
  shareLink.value = generateShareableLink(id, type);
  shareLink.readOnly = true;
  shareLink.classList.add('share-link-input');
  shareLink.setAttribute('aria-label', `Shareable link for ${type} ID ${id}`);

  // Add copy button
  const copyButton = document.createElement('button');
  copyButton.classList.add('copy-button');
  copyButton.setAttribute('aria-label', 'Copy link');
  copyButton.innerHTML = '📋'; // Using clipboard emoji as copy icon

  // Event listener for copy functionality
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareLink.value);
      copyButton.innerHTML = '✅'; // Change icon to indicate success
      logMessage(`Shareable link for ${type} ID ${id} copied to clipboard.`, 'info');

      // Revert the icon back after 2 seconds
      setTimeout(() => {
        copyButton.innerHTML = '📋';
      }, 2000);
    } catch (err) {
      logMessage(`Failed to copy shareable link for ${type} ID ${id}: ${err.message}`, 'error');
      alert('Failed to copy the link. Please try manually.');
    }
  });

  shareContainer.appendChild(shareLink);
  shareContainer.appendChild(copyButton);

  // Append to target container
  targetContainer.appendChild(shareContainer);
  logMessage(`Shareable link generated for ${type} ID ${id}.`, 'info');
}

/**
 * Displays the download link and copy button once the job is completed.
 * Checks if the buttons already exist to prevent duplicates.
 * Also clears the countdown and hides the spinner.
 * @param {string} jobId - The job identifier.
 * @param {object} context - An object containing necessary DOM elements and state.
 */
export function displayDownloadLink(jobId, context) {
  logMessage(`✅ displayDownloadLink called for Job ID: ${jobId}`, 'info');
  logMessage(`Context keys: ${Object.keys(context).join(', ')}`, 'info');

  const { hidePlaceholderMessage, jobStatusDiv, clearCountdown } = context;

  hidePlaceholderMessage(); // Hide placeholder when displaying download link

  // Enhanced validation for 'jobId'
  if (typeof jobId !== 'string' || jobId.trim() === '') {
    logMessage(
      'Invalid Job ID provided to displayDownloadLink: undefined, null, or empty string.',
      'error'
    );
    return;
  }

  if (!(jobStatusDiv instanceof HTMLElement)) {
    logMessage('jobStatusDiv provided to displayDownloadLink is not a valid DOM element.', 'error');
    logMessage(`jobStatusDiv type: ${typeof jobStatusDiv}, value: ${jobStatusDiv}`, 'error');
    return;
  }

  // Check if the download and copy buttons already exist
  const existingDownloadLink = document.getElementById(`download-${jobId}`);
  const existingCopyButton = document.getElementById(`copy-${jobId}`);

  logMessage(
    `Checking for existing elements: download=${!!existingDownloadLink}, copy=${!!existingCopyButton}`,
    'info'
  );

  if (existingDownloadLink && existingCopyButton) {
    logMessage(
      `⚠️ Download and Copy Link buttons already exist for Job ID ${jobId}. Skipping creation.`,
      'warning'
    );
    return; // Exit the function to prevent duplication
  }

  logMessage(`✨ Creating download and copy buttons for Job ID ${jobId}...`, 'info');

  // Create Download Link
  const downloadLink = document.createElement('a');
  downloadLink.id = `download-${jobId}`; // Assign unique ID
  downloadLink.href = `${window.CONFIG.API_URL}/download/${encodeURIComponent(jobId)}/`;
  downloadLink.textContent = 'Download vntyper results';
  downloadLink.classList.add('download-link', 'download-button');
  downloadLink.target = '_blank'; // Open in a new tab
  downloadLink.setAttribute('aria-label', `Download results for Job ID ${jobId}`);
  downloadLink.setAttribute('data-copyable', 'true'); // Make link copyable

  // Create Copy Button
  const copyButton = document.createElement('button');
  copyButton.id = `copy-${jobId}`; // Assign unique ID
  copyButton.textContent = 'Copy Link';
  copyButton.classList.add('copy-button');
  copyButton.setAttribute('aria-label', `Copy shareable link for Job ID ${jobId}`);
  copyButton.addEventListener('click', () => {
    navigator.clipboard
      .writeText(downloadLink.href)
      .then(() => {
        logMessage(`Shareable link copied for Job ID ${jobId}.`, 'success');
        alert('Shareable link copied to clipboard!');
      })
      .catch(err => {
        logMessage(`Failed to copy link for Job ID ${jobId}: ${err.message}`, 'error');
        alert('Failed to copy the link. Please try manually.');
      });
  });

  // Append Download Link and Copy Button to the job status div
  const lineBreak = document.createElement('br');
  jobStatusDiv.appendChild(lineBreak);
  jobStatusDiv.appendChild(downloadLink);
  jobStatusDiv.appendChild(copyButton);

  logMessage(`✅ Download and Copy Link buttons appended to DOM for Job ID ${jobId}.`, 'success');
  logMessage(`Download link href: ${downloadLink.href}`, 'info');
  logMessage(`jobStatusDiv now has ${jobStatusDiv.children.length} children`, 'info');

  // Clear the countdown and hide the spinner
  if (typeof clearCountdown === 'function') {
    logMessage(`Calling clearCountdown...`, 'info');
    clearCountdown();
    logMessage(`clearCountdown completed.`, 'info');
  } else {
    logMessage('⚠️ clearCountdown function not provided in context.', 'warning');
  }
}

/**
 * Displays the loading spinner in the UI.
 * Uses StateManager for proper nesting support.
 */
export function showSpinner() {
  stateManager.showSpinner();
}

/**
 * Hides the loading spinner in the UI.
 * Uses StateManager for proper nesting support.
 */
export function hideSpinner() {
  stateManager.hideSpinner();
}

/**
 * Starts a countdown timer that updates the UI every second.
 * Uses StateManager to prevent race conditions.
 * @param {string} jobId - Optional job ID this countdown is for
 */
export function startCountdown(jobId = null) {
  stateManager.startCountdown(jobId);
}

/**
 * Resets the countdown timer to the initial value.
 * Uses StateManager for centralized state.
 */
export function resetCountdown() {
  stateManager.resetCountdown();
}

/**
 * Clears the countdown timer and removes its display from the UI.
 * Uses StateManager for proper cleanup.
 */
export function clearCountdown() {
  stateManager.clearCountdown();
}

/* --- Unified Spinner Creation (DRY) --- */

/**
 * Creates a standardized animated SVG spinner with consistent styling.
 * Follows DRY, KISS, and SOLID principles by centralizing spinner HTML generation.
 *
 * @param {Object} options - Configuration options for the spinner
 * @param {number} [options.size=16] - Size of the spinner in pixels (16 for buttons, 40 for output areas)
 * @param {string} [options.color='currentColor'] - Color of the spinner (use 'currentColor' for buttons, '#3498db' for areas)
 * @param {string} [options.text=''] - Optional text to display next to the spinner
 * @param {boolean} [options.inline=true] - Whether the spinner is inline (for buttons) or block (for areas)
 * @returns {string} HTML string containing the animated SVG spinner
 *
 * @example
 * // Button spinner
 * button.innerHTML = createSpinnerHTML({ size: 16, text: 'Processing...' });
 *
 * // Large centered spinner
 * div.innerHTML = createSpinnerHTML({ size: 40, color: '#3498db', text: 'Loading...', inline: false });
 */
export function createSpinnerHTML({
  size = 16,
  color = 'currentColor',
  text = '',
  inline = true,
} = {}) {
  const radius = size * 0.375; // 6/16 for 16px, 15/40 for 40px
  const strokeWidth = size * 0.125; // 2/16 for 16px, 3/40 for 40px (adjusted slightly)
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const dashArray = circumference * 0.75; // 75% of circumference
  const dashOffset = dashArray / 2; // Half dashArray for the moving part

  const spinnerSVG = `
        <svg class="spinner-icon" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display: ${inline ? 'inline-block; vertical-align: middle;' : 'block;'} ${text && inline ? 'margin-right: 8px;' : ''} margin: 0 auto;">
            <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" opacity="0.25"/>
            <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${dashArray}" stroke-dashoffset="${dashOffset}" style="animation: spin 1s linear infinite; transform-origin: center;"/>
        </svg>
    `;

  if (inline && text) {
    return `${spinnerSVG}${text}`;
  } else if (!inline && text) {
    return `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
                ${spinnerSVG}
                <div style="color: #666; font-style: italic;">${text}</div>
            </div>
        `;
  } else {
    return spinnerSVG;
  }
}

/**
 * Creates a standardized assembly detection message banner.
 * Follows DRY principles by centralizing banner HTML and styling.
 *
 * @param {string} assembly - The detected assembly (e.g., 'hg19', 'hg38', 'GRCh37', 'GRCh38')
 * @returns {string} HTML string containing the styled assembly message
 *
 * @example
 * div.innerHTML = createAssemblyMessageHTML('hg19');
 */
export function createAssemblyMessageHTML(assembly) {
  return `
        <div class="assembly-info-message" style="
            background-color: #e7f3fe;
            color: #31708f;
            border: 1px solid #bce8f1;
            border-radius: 4px;
            padding: 12px 16px;
            margin-bottom: 16px;
            font-size: 0.95rem;
            text-align: center;
        ">
            Detected reference assembly: ${assembly.toUpperCase()}. Please confirm or select manually.
        </div>
    `;
}

/**
 * Adds CSS keyframe animation for spinner rotation if not already present.
 * This ensures the spin animation works even if it's not in the global CSS.
 */
export function ensureSpinAnimation() {
  const styleId = 'spinner-animation-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
    document.head.appendChild(style);
  }
}

/* --- Toggle Optional Inputs Functionality --- */

/**
 * Initializes the toggle functionality for optional inputs (Email and Cohort Alias).
 * This function adds an event listener to the toggle button to show/hide the optional inputs.
 */
function initializeToggleOptionalInputs() {
  const toggleButton = document.getElementById('toggleOptionalInputs');
  const additionalInputs = document.getElementById('additionalInputs');

  if (!toggleButton || !additionalInputs) {
    logMessage(
      'Toggle button (#toggleOptionalInputs) or additional inputs container (#additionalInputs) not found in the DOM.',
      'warning'
    );
    return;
  }

  toggleButton.addEventListener('click', () => {
    const isHidden = additionalInputs.classList.contains('hidden');

    if (isHidden) {
      // Show optional inputs
      additionalInputs.classList.remove('hidden');
      additionalInputs.classList.add('visible');
      toggleButton.textContent = 'Hide options';
      toggleButton.setAttribute('aria-expanded', 'true');
      logMessage('Optional inputs displayed.', 'info');

      // Initialize validation for optional inputs
      try {
        logMessage('About to initialize validation...', 'debug');
        initializeValidation(['email', 'cohortAlias', 'passphrase']);
        logMessage('Validation initialized successfully', 'success');
      } catch (error) {
        logMessage(`Error initializing validation: ${error.message}`, 'error');
        console.error('Validation initialization error:', error);
      }
    } else {
      // Hide optional inputs
      additionalInputs.classList.remove('visible');
      additionalInputs.classList.add('hidden');
      toggleButton.textContent = 'Show options';
      toggleButton.setAttribute('aria-expanded', 'false');
      logMessage('Optional inputs hidden.', 'info');

      // Clear validation states when hiding
      try {
        clearAllValidation(['email', 'cohortAlias', 'passphrase']);
      } catch (error) {
        logMessage(`Error clearing validation: ${error.message}`, 'error');
      }
    }
  });

  logMessage('Toggle functionality for optional inputs initialized.', 'info');
}

/**
 * Initializes click functionality for the header to reset the page.
 */
export function initializePageReset() {
  const resetHeader = document.getElementById('resetHeader');
  if (resetHeader) {
    resetHeader.addEventListener('click', () => {
      window.location.reload(); // Reload the page
    });
    logMessage('Page reset functionality initialized.', 'info');
  } else {
    logMessage('Reset header (#resetHeader) not found in the DOM.', 'warning');
  }
}

/* --- Initialize All UI Utilities --- */

/**
 * Sets up StateManager event listeners for DOM updates
 */
function setupStateManagerListeners() {
  // Countdown tick - update DOM
  stateManager.on('countdown.tick', timeLeft => {
    const countdownDiv = document.getElementById('countdown');
    if (countdownDiv) {
      countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
    }
  });

  // Countdown stopped - clear DOM
  stateManager.on('countdown.stopped', () => {
    const countdownDiv = document.getElementById('countdown');
    if (countdownDiv) {
      countdownDiv.textContent = '';
      logMessage('Countdown display cleared from UI.', 'info');
    }
  });

  // Countdown started - initial display
  stateManager.on('countdown.started', jobId => {
    const countdownDiv = document.getElementById('countdown');
    if (countdownDiv) {
      const timeLeft = stateManager.get('countdown.timeLeft');
      countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
      logMessage(
        `Countdown started with ${timeLeft} seconds${jobId ? ` for job ${jobId}` : ''}.`,
        'info'
      );
    } else {
      logMessage('Countdown element (#countdown) not found in the DOM.', 'warning');
    }
  });

  // Countdown reset - update DOM
  stateManager.on('countdown.reset', () => {
    const countdownDiv = document.getElementById('countdown');
    if (countdownDiv) {
      const timeLeft = stateManager.get('countdown.timeLeft');
      countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
      logMessage('Countdown reset manually to 20 seconds.', 'info');
    } else {
      logMessage('Countdown element (#countdown) not found in the DOM.', 'warning');
    }
  });

  // Spinner shown - inject SVG
  stateManager.on('spinner.shown', () => {
    const spinner = document.getElementById('spinner');
    if (spinner) {
      spinner.innerHTML = createSpinnerHTML({
        size: 40,
        color: '#3498db',
        text: '',
        inline: false,
      });
      spinner.classList.remove('hidden');
      spinner.classList.add('visible');
      logMessage('Spinner displayed.', 'info');
    } else {
      logMessage('Spinner element (#spinner) not found in the DOM.', 'warning');
    }
  });

  // Spinner hidden - clear content
  stateManager.on('spinner.hidden', () => {
    const spinner = document.getElementById('spinner');
    if (spinner) {
      spinner.innerHTML = '';
      spinner.classList.remove('visible');
      spinner.classList.add('hidden');
      logMessage('Spinner hidden.', 'info');
    } else {
      logMessage('Spinner element (#spinner) not found in the DOM.', 'warning');
    }
  });

  logMessage('StateManager event listeners set up for DOM updates.', 'info');
}

/**
 * Initializes all UI utilities by calling their respective initialization functions.
 * This function should be called once the DOM is fully loaded.
 */
export function initializeUIUtils() {
  logMessage('Initializing UI utilities...', 'info');
  setupStateManagerListeners(); // Set up state listeners first
  initializeToggleOptionalInputs();
  initializePageReset();
  logMessage('UI utilities initialized.', 'info');
}
