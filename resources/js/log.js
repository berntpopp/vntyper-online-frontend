// frontend/resources/js/log.js

/**
 * Logging Module
 * Provides in-UI logging with filtering, download, and persistence capabilities.
 * Follows SOLID principles and DRY/KISS patterns.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

const MAX_LOG_ENTRIES = 100;
const STORAGE_KEY_VISIBILITY = 'logContainerVisible';
const STORAGE_KEY_FILTER = 'logFilter';
const FILTER_ALL = 'all';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let currentFilter = FILTER_ALL;

// ============================================================================
// CORE LOGGING FUNCTIONS
// ============================================================================

/**
 * Logs a message to the in-UI logging panel.
 * @param {string} message - The message to log
 * @param {string} level - The log level (debug, info, success, warning, error)
 */
export function logMessage(message, level = LOG_LEVELS.INFO) {
  const logContent = getLogContentElement();
  if (!logContent) return;

  const logEntry = createLogEntry(message, level);
  appendLogEntry(logContent, logEntry);
  enforceMaxLogEntries(logContent);
  scrollToBottom(logContent);
}

/**
 * Sets the current filter level and updates the UI.
 * @param {string} level - Filter level ('all', 'debug', 'info', 'success', 'warning', 'error')
 */
export function setLogFilter(level) {
  currentFilter = level;
  updateFilterButtonStates(level);
  applyLogFilter();
  saveFilterPreference(level);
}

/**
 * Downloads logs in the specified format.
 * @param {string} format - Export format ('txt' or 'json')
 */
export function downloadLogs(format = 'txt') {
  const logEntries = getAllLogEntries();

  if (logEntries.length === 0) {
    alert('No logs to download');
    return;
  }

  const { content, mimeType, filename } = prepareDownloadData(logEntries, format);
  triggerDownload(content, mimeType, filename);
  logMessage(`Downloaded ${logEntries.length} logs as ${format.toUpperCase()}`, LOG_LEVELS.SUCCESS);
}

/**
 * Clears all log entries after user confirmation.
 */
export function clearLogs() {
  if (!confirm('Clear all logs?')) {
    return;
  }

  const logContent = getLogContentElement();
  if (!logContent) return;

  logContent.innerHTML = '';
  logMessage('All logs have been cleared.', LOG_LEVELS.INFO);
}

/**
 * Initializes the logging system by setting up event listeners and restoring state.
 */
export function initializeLogging() {
  setupToggleButton();
  setupCloseButton();
  setupClearButton();
  setupFilterButtons();
  setupDownloadButton();
  restoreVisibilityState();
  restoreFilterState();
  logMessage('Logging system initialized.', LOG_LEVELS.INFO);
}

// ============================================================================
// LOG ENTRY CREATION AND MANAGEMENT
// ============================================================================

/**
 * Creates a log entry DOM element.
 * @param {string} message - The log message
 * @param {string} level - The log level
 * @returns {HTMLElement} The log entry element
 */
function createLogEntry(message, level) {
  const logEntry = document.createElement('div');
  logEntry.classList.add('log-entry', `log-${level}`);
  logEntry.dataset.level = level;
  logEntry.dataset.timestamp = new Date().toISOString();

  const timestamp = formatTimestamp();
  const levelLabel = capitalizeFirstLetter(level);

  const strong = document.createElement('strong');
  strong.textContent = `[${timestamp}] [${levelLabel}]`;

  logEntry.appendChild(strong);
  logEntry.appendChild(document.createTextNode(` ${message}`));

  return logEntry;
}

/**
 * Appends a log entry to the log content area.
 * @param {HTMLElement} logContent - The log content container
 * @param {HTMLElement} logEntry - The log entry to append
 */
function appendLogEntry(logContent, logEntry) {
  logContent.appendChild(logEntry);

  // Apply current filter to the new entry
  const shouldShow = currentFilter === FILTER_ALL || logEntry.dataset.level === currentFilter;
  logEntry.style.display = shouldShow ? 'block' : 'none';
}

/**
 * Enforces the maximum number of log entries.
 * @param {HTMLElement} logContent - The log content container
 */
function enforceMaxLogEntries(logContent) {
  while (logContent.children.length > MAX_LOG_ENTRIES) {
    logContent.removeChild(logContent.firstChild);
  }
}

/**
 * Scrolls the log content to the bottom.
 * @param {HTMLElement} logContent - The log content container
 */
function scrollToBottom(logContent) {
  logContent.scrollTo({
    top: logContent.scrollHeight,
    behavior: 'smooth',
  });
}

// ============================================================================
// FILTERING FUNCTIONS
// ============================================================================

/**
 * Applies the current filter to all log entries.
 */
function applyLogFilter() {
  const logContent = getLogContentElement();
  if (!logContent) return;

  const entries = logContent.querySelectorAll('.log-entry');
  entries.forEach(entry => {
    const level = entry.dataset.level;
    const shouldShow = currentFilter === FILTER_ALL || level === currentFilter;
    entry.style.display = shouldShow ? 'block' : 'none';
  });
}

/**
 * Updates the active state of filter buttons.
 * @param {string} activeLevel - The active filter level
 */
function updateFilterButtonStates(activeLevel) {
  const filterButtons = document.querySelectorAll('.log-filter-btn');
  filterButtons.forEach(button => {
    const isActive = button.dataset.level === activeLevel;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive.toString());
  });
}

// ============================================================================
// DOWNLOAD FUNCTIONS
// ============================================================================

/**
 * Retrieves all log entries as an array.
 * @returns {Array<HTMLElement>} Array of log entry elements
 */
function getAllLogEntries() {
  const logContent = getLogContentElement();
  if (!logContent) return [];

  return Array.from(logContent.querySelectorAll('.log-entry'));
}

/**
 * Prepares download data in the specified format.
 * @param {Array<HTMLElement>} entries - Log entries to export
 * @param {string} format - Export format ('txt' or 'json')
 * @returns {Object} Download data with content, mimeType, and filename
 */
function prepareDownloadData(entries, format) {
  const timestamp = getFormattedDateTimeString();

  if (format === 'json') {
    return {
      content: JSON.stringify(formatEntriesAsJSON(entries), null, 2),
      mimeType: 'application/json',
      filename: `vntyper-logs-${timestamp}.json`,
    };
  }

  return {
    content: formatEntriesAsText(entries),
    mimeType: 'text/plain',
    filename: `vntyper-logs-${timestamp}.txt`,
  };
}

/**
 * Formats log entries as JSON.
 * @param {Array<HTMLElement>} entries - Log entries to format
 * @returns {Array<Object>} Formatted log entries
 */
function formatEntriesAsJSON(entries) {
  return entries.map(entry => ({
    timestamp: entry.dataset.timestamp,
    level: entry.dataset.level,
    message: extractMessage(entry.textContent),
  }));
}

/**
 * Formats log entries as plain text.
 * @param {Array<HTMLElement>} entries - Log entries to format
 * @returns {string} Plain text log content
 */
function formatEntriesAsText(entries) {
  return entries.map(entry => entry.textContent).join('\n');
}

/**
 * Extracts the message content from a formatted log entry text.
 * @param {string} text - Full log entry text
 * @returns {string} Message without timestamp and level prefix
 */
function extractMessage(text) {
  return text.replace(/^\[\d{2}:\d{2}:\d{2}\] \[\w+\] /, '');
}

/**
 * Triggers a file download.
 * @param {string} content - File content
 * @param {string} mimeType - MIME type
 * @param {string} filename - File name
 */
function triggerDownload(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  // Clean up the blob URL to prevent memory leaks
  URL.revokeObjectURL(url);
}

// ============================================================================
// EVENT LISTENER SETUP
// ============================================================================

/**
 * Sets up the toggle button event listener.
 */
function setupToggleButton() {
  const toggleLogBtn = document.getElementById('toggleLogBtn');
  const logContainer = document.getElementById('logContainer');

  if (!toggleLogBtn || !logContainer) return;

  toggleLogBtn.addEventListener('click', () => {
    toggleLogVisibility(logContainer, toggleLogBtn);
  });
}

/**
 * Sets up the close button event listener.
 */
function setupCloseButton() {
  const logContainer = document.getElementById('logContainer');
  const closeLogBtn = logContainer?.querySelector('.close-log-btn');
  const toggleLogBtn = document.getElementById('toggleLogBtn');

  if (!closeLogBtn || !logContainer || !toggleLogBtn) return;

  closeLogBtn.addEventListener('click', () => {
    hideLogPanel(logContainer, toggleLogBtn);
  });
}

/**
 * Sets up the clear button event listener.
 */
function setupClearButton() {
  const logContainer = document.getElementById('logContainer');
  const clearLogBtn = logContainer?.querySelector('.clear-log-btn');

  if (!clearLogBtn) return;

  clearLogBtn.addEventListener('click', () => {
    clearLogs();
  });
}

/**
 * Sets up filter button event listeners.
 */
function setupFilterButtons() {
  const filterButtons = document.querySelectorAll('.log-filter-btn');

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      setLogFilter(button.dataset.level);
    });
  });
}

/**
 * Sets up the download button event listener.
 */
function setupDownloadButton() {
  const downloadBtn = document.getElementById('downloadLogsBtn');
  const formatSelect = document.getElementById('downloadFormatSelect');

  if (!downloadBtn || !formatSelect) return;

  downloadBtn.addEventListener('click', () => {
    const format = formatSelect.value;
    downloadLogs(format);
  });
}

/**
 * Toggles the visibility of the log panel.
 * @param {HTMLElement} logContainer - The log container element
 * @param {HTMLElement} toggleButton - The toggle button element
 */
function toggleLogVisibility(logContainer, toggleButton) {
  const isCurrentlyVisible = logContainer.classList.contains('visible');

  if (isCurrentlyVisible) {
    hideLogPanel(logContainer, toggleButton);
  } else {
    showLogPanel(logContainer, toggleButton);
  }

  logMessage(`Logging panel ${isCurrentlyVisible ? 'closed' : 'opened'}.`, LOG_LEVELS.INFO);
}

/**
 * Shows the log panel.
 * @param {HTMLElement} logContainer - The log container element
 * @param {HTMLElement} toggleButton - The toggle button element
 */
function showLogPanel(logContainer, toggleButton) {
  logContainer.classList.add('visible');
  logContainer.classList.remove('hidden');
  toggleButton.setAttribute('aria-expanded', 'true');
  saveVisibilityState(true);
}

/**
 * Hides the log panel.
 * @param {HTMLElement} logContainer - The log container element
 * @param {HTMLElement} toggleButton - The toggle button element
 */
function hideLogPanel(logContainer, toggleButton) {
  logContainer.classList.add('hidden');
  logContainer.classList.remove('visible');
  toggleButton.setAttribute('aria-expanded', 'false');
  saveVisibilityState(false);
}

// ============================================================================
// STATE PERSISTENCE
// ============================================================================

/**
 * Restores the visibility state from localStorage.
 */
function restoreVisibilityState() {
  const logContainer = document.getElementById('logContainer');
  const toggleLogBtn = document.getElementById('toggleLogBtn');

  if (!logContainer || !toggleLogBtn) return;

  const isVisible = localStorage.getItem(STORAGE_KEY_VISIBILITY) === 'true';

  if (isVisible) {
    showLogPanel(logContainer, toggleLogBtn);
  } else {
    hideLogPanel(logContainer, toggleLogBtn);
  }
}

/**
 * Saves the visibility state to localStorage.
 * @param {boolean} isVisible - Whether the panel is visible
 */
function saveVisibilityState(isVisible) {
  localStorage.setItem(STORAGE_KEY_VISIBILITY, isVisible.toString());
}

/**
 * Restores the filter state from localStorage.
 */
function restoreFilterState() {
  const savedFilter = localStorage.getItem(STORAGE_KEY_FILTER) || FILTER_ALL;
  setLogFilter(savedFilter);
}

/**
 * Saves the filter preference to localStorage.
 * @param {string} level - The filter level to save
 */
function saveFilterPreference(level) {
  localStorage.setItem(STORAGE_KEY_FILTER, level);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets the log content element.
 * @returns {HTMLElement|null} The log content element
 */
function getLogContentElement() {
  return document.getElementById('logContent');
}

/**
 * Formats the current time as HH:MM:SS.
 * @returns {string} Formatted timestamp
 */
function formatTimestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Gets a formatted date-time string for filenames.
 * @returns {string} Formatted date-time string (YYYY-MM-DD-HHMMSS)
 */
function getFormattedDateTimeString() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalizeFirstLetter(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
