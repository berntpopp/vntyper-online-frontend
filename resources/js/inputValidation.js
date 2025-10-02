// frontend/resources/js/inputValidation.js

import {
    validateEmail,
    validateCohortAlias,
    validatePassphrase
} from './validators.js';
import { logMessage } from './log.js';

/**
 * Input Validation UI Controller
 *
 * Provides real-time validation with visual feedback for form inputs.
 * Uses existing validators from validators.js and adds UI state management.
 *
 * Features:
 * - Inline validation on blur
 * - Visual error/success states
 * - Helpful error messages
 * - Smooth animations
 * - Preserves user input
 *
 * SOLID Principles:
 * - Single Responsibility: Each function handles one aspect of validation UI
 * - Open/Closed: Easy to extend with new validators
 * - Dependency Inversion: Uses validator abstractions
 *
 * @module inputValidation
 */

/**
 * Validation rules configuration
 * Maps input fields to their validation functions and error messages
 */
const VALIDATION_RULES = {
    email: {
        validator: validateEmail,
        errorMessage: 'Please enter a valid email address (e.g., user@example.com)',
        successMessage: 'Valid email address',
        optional: true
    },
    cohortAlias: {
        validator: validateCohortAlias,
        errorMessage: 'Cohort alias must be 3-64 characters (letters, numbers, spaces, hyphens, underscores)',
        successMessage: 'Valid cohort alias',
        optional: true
    },
    passphrase: {
        validator: validatePassphrase,
        errorMessage: 'Passphrase must be 8-128 characters long',
        successMessage: 'Valid passphrase',
        optional: true
    }
};

/**
 * Add error visual state and message to an input
 *
 * @param {HTMLInputElement} inputElement - The input element
 * @param {string} message - Error message to display
 */
export function showError(inputElement, message) {
    if (!inputElement) return;

    // Remove any existing states
    inputElement.classList.remove('success');
    inputElement.classList.add('error');

    // Remove existing message if any
    removeMessage(inputElement);

    // Create and insert error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.setAttribute('role', 'alert');
    errorDiv.setAttribute('aria-live', 'polite');

    // Text content (emoji added via CSS ::before)
    const messageText = document.createTextNode(message);
    errorDiv.appendChild(messageText);

    // Insert after the input
    inputElement.parentNode.insertBefore(errorDiv, inputElement.nextSibling);

    // Update aria-invalid
    inputElement.setAttribute('aria-invalid', 'true');
    inputElement.setAttribute('aria-describedby', errorDiv.id || 'error-message');

    logMessage(`Validation error shown for ${inputElement.id}: ${message}`, 'debug');
}

/**
 * Add success visual state to an input
 *
 * @param {HTMLInputElement} inputElement - The input element
 * @param {string} [message] - Optional success message to display
 */
export function showSuccess(inputElement, message = null) {
    if (!inputElement) return;

    // Remove error state
    inputElement.classList.remove('error');
    inputElement.classList.add('success');

    // Remove existing message
    removeMessage(inputElement);

    // Optionally show success message (subtle, can be disabled)
    if (message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.setAttribute('role', 'status');
        successDiv.setAttribute('aria-live', 'polite');

        const messageText = document.createTextNode(message);
        successDiv.appendChild(messageText);

        inputElement.parentNode.insertBefore(successDiv, inputElement.nextSibling);
    }

    // Update aria-invalid
    inputElement.setAttribute('aria-invalid', 'false');
    inputElement.removeAttribute('aria-describedby');

    logMessage(`Validation success shown for ${inputElement.id}`, 'debug');
}

/**
 * Remove all validation messages and states from an input
 *
 * @param {HTMLInputElement} inputElement - The input element
 */
export function clearValidation(inputElement) {
    if (!inputElement) return;

    inputElement.classList.remove('error', 'success');
    removeMessage(inputElement);
    inputElement.removeAttribute('aria-invalid');
    inputElement.removeAttribute('aria-describedby');
}

/**
 * Remove error/success message elements
 *
 * @param {HTMLInputElement} inputElement - The input element
 * @private
 */
function removeMessage(inputElement) {
    // Remove error message
    const errorMsg = inputElement.nextElementSibling;
    if (errorMsg && (errorMsg.classList.contains('error-message') || errorMsg.classList.contains('success-message'))) {
        errorMsg.remove();
    }
}

/**
 * Validate a single input field
 *
 * @param {string} inputId - ID of the input element
 * @param {string} value - Value to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function validateInput(inputId, value) {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) {
        logMessage(`Input element not found: ${inputId}`, 'warn');
        return false;
    }

    const rule = VALIDATION_RULES[inputId];
    if (!rule) {
        logMessage(`No validation rule found for: ${inputId}`, 'warn');
        return true; // No rule = considered valid
    }

    // Handle optional fields
    if (rule.optional && (!value || value.trim() === '')) {
        clearValidation(inputElement);
        return true;
    }

    // Run validator
    const validatedValue = rule.validator(value);
    const isValid = validatedValue !== null;

    if (!isValid) {
        showError(inputElement, rule.errorMessage);
        return false;
    } else {
        // Show success (without message for cleaner UI)
        showSuccess(inputElement);
        return true;
    }
}

/**
 * Set up validation for a single input field
 *
 * @param {string} inputId - ID of the input element
 */
export function setupValidation(inputId) {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) {
        logMessage(`Cannot setup validation: input not found - ${inputId}`, 'warn');
        return;
    }

    // Validate on blur
    inputElement.addEventListener('blur', (e) => {
        validateInput(inputId, e.target.value);
    });

    // Clear error on focus (give user a fresh start)
    inputElement.addEventListener('focus', (e) => {
        if (e.target.classList.contains('error')) {
            removeMessage(e.target);
            // Keep error class until they fix it, just remove the message
        }
    });

    // Optional: Real-time validation while typing (debounced)
    let debounceTimer;
    inputElement.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);

        // Only validate if there's already an error (help them fix it)
        if (e.target.classList.contains('error')) {
            debounceTimer = setTimeout(() => {
                validateInput(inputId, e.target.value);
            }, 500); // 500ms debounce
        }
    });

    logMessage(`Validation setup completed for: ${inputId}`, 'info');
}

/**
 * Initialize validation for all form inputs
 *
 * @param {string[]} inputIds - Array of input IDs to validate
 */
export function initializeValidation(inputIds = ['email', 'cohortAlias', 'passphrase']) {
    logMessage('Initializing input validation...', 'info');

    inputIds.forEach(inputId => {
        setupValidation(inputId);
    });

    logMessage(`Validation initialized for ${inputIds.length} inputs`, 'success');
}

/**
 * Validate all inputs before form submission
 *
 * @param {string[]} inputIds - Array of input IDs to validate
 * @returns {boolean} - True if all valid, false if any invalid
 */
export function validateAll(inputIds = ['email', 'cohortAlias', 'passphrase']) {
    let allValid = true;

    inputIds.forEach(inputId => {
        const inputElement = document.getElementById(inputId);
        if (inputElement) {
            const isValid = validateInput(inputId, inputElement.value);
            if (!isValid) {
                allValid = false;
            }
        }
    });

    return allValid;
}

/**
 * Clear all validation states
 *
 * @param {string[]} inputIds - Array of input IDs to clear
 */
export function clearAllValidation(inputIds = ['email', 'cohortAlias', 'passphrase']) {
    inputIds.forEach(inputId => {
        const inputElement = document.getElementById(inputId);
        if (inputElement) {
            clearValidation(inputElement);
        }
    });

    logMessage('All validation states cleared', 'info');
}
