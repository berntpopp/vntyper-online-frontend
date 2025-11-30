// frontend/resources/js/views/ErrorView.js

import { displayError, clearError } from '../errorHandling.js';

/**
 * Error View - Handles error display
 *
 * Purpose: Centralized error UI rendering, separating error presentation
 * from business logic.
 *
 * Benefits:
 * - Single Responsibility: Only handles error UI
 * - Reusability: Can be used by any controller
 * - Consistency: All errors displayed the same way
 * - Testability: Easy to test UI rendering
 *
 * SOLID Principles:
 * - Single Responsibility: Only renders error UI
 * - Open/Closed: Easy to extend with new error types
 * - Dependency Inversion: Uses error handling abstraction
 *
 * @class ErrorView
 */
export class ErrorView {
  /**
   * @param {Object} [dependencies={}] - Injected dependencies
   * @param {HTMLElement} [dependencies.container] - Error container element
   */
  constructor(dependencies = {}) {
    this.container = dependencies.container || null;
  }

  /**
   * Show an error message
   * @param {string|Error} error - Error message or Error object
   * @param {string} [context] - Error context
   */
  show(error, context = '') {
    const message = error instanceof Error ? error.message : String(error);
    const fullMessage = context ? `${context}: ${message}` : message;

    displayError(fullMessage);
  }

  /**
   * Show a validation error
   * @param {string} message - Validation error message
   */
  showValidation(message) {
    this.show(`Validation Error: ${message}`);
  }

  /**
   * Show a network error
   * @param {Error} error - Network error
   */
  showNetwork(error) {
    this.show(error, 'Network Error');
  }

  /**
   * Show an API error
   * @param {Error} error - API error
   * @param {number} [statusCode] - HTTP status code
   */
  showAPI(error, statusCode) {
    const context = statusCode ? `API Error (${statusCode})` : 'API Error';
    this.show(error, context);
  }

  /**
   * Show a generic error
   * @param {string} message - Error message
   */
  showGeneric(message) {
    this.show(message, 'Error');
  }

  /**
   * Clear all errors
   */
  clear() {
    clearError();
  }

  /**
   * Show multiple errors
   * @param {Array<string|Error>} errors - Array of errors
   */
  showMultiple(errors) {
    if (!Array.isArray(errors) || errors.length === 0) {
      return;
    }

    const messages = errors.map(e => (e instanceof Error ? e.message : String(e)));

    this.show(messages.join('; '));
  }
}
