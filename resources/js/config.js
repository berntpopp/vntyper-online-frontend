// frontend/resources/js/config.js

// Detect development mode (running on dev server on port 3000)
const isDev = window.location.port === '3000';
const defaultApiUrl = isDev ? 'http://localhost:8000/api' : '/api';
const apiUrl = window.CONFIG?.API_URL || defaultApiUrl;
const defaultApiDocsUrl = isDev ? 'http://localhost:8000/api/docs' : `${apiUrl}/docs`;

window.CONFIG = {
  // In dev mode, call backend directly on port 8000
  // In production, use relative path (handled by nginx proxy)
  API_URL: apiUrl,
  API_DOCS_URL: window.CONFIG?.API_DOCS_URL || defaultApiDocsUrl,
  ENABLE_DONATIONS: window.CONFIG?.ENABLE_DONATIONS ?? false,
  DEFAULT_ADVNTR_MODE: window.CONFIG?.DEFAULT_ADVNTR_MODE ?? true,
  DEFAULT_NORMAL_MODE: window.CONFIG?.DEFAULT_NORMAL_MODE ?? true,
  FORCE_ADVNTR_MODE: window.CONFIG?.FORCE_ADVNTR_MODE ?? false,
  FORCE_NORMAL_MODE: window.CONFIG?.FORCE_NORMAL_MODE ?? false,
};
