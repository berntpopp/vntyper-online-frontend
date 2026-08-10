// frontend/resources/js/utils/safeStorage.js

/**
 * localStorage access that cannot throw.
 *
 * Storage access raises SecurityError when cookies are blocked, inside an
 * <iframe sandbox> without allow-same-origin, and under some enterprise
 * webview policies. It also raises QuotaExceededError when full.
 *
 * An unguarded call inside an initializer takes the whole application down:
 * the page renders completely and every control is inert. Every storage
 * access therefore goes through here.
 *
 * @module safeStorage
 */
export const safeStorage = {
  /**
   * Read a value.
   * @param {string} key - Storage key
   * @returns {string|null} The stored value, or null if absent or unavailable
   */
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  /**
   * Write a value.
   * @param {string} key - Storage key
   * @param {string} value - Value to store
   * @returns {boolean} true when the value was persisted
   */
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Remove a value.
   * @param {string} key - Storage key
   * @returns {boolean} true when the key was removed
   */
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};
