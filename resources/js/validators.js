/**
 * Input Validation Functions for Security
 *
 * This module provides validation functions for user inputs and URL parameters
 * to prevent injection attacks (XSS, path traversal, SQL injection, etc.)
 *
 * @module validators
 */

/**
 * Validate job ID format
 *
 * Job IDs should be:
 * - 8-64 characters long
 * - Alphanumeric and hyphens only
 * - No path traversal attempts (.., /, \)
 *
 * @param {string} id - Job ID from URL or user input
 * @returns {string|null} - Valid ID or null if invalid
 *
 * @example
 * const jobId = validateJobId(urlParams.get('job_id'));
 * if (jobId) {
 *   loadJobFromURL(jobId);
 * }
 */
export function validateJobId(id) {
    // Type check
    if (!id || typeof id !== 'string') {
        return null;
    }

    // Length check (8-64 chars)
    if (id.length < 8 || id.length > 64) {
        console.warn(`Invalid job ID length: ${id.length} (expected 8-64)`);
        return null;
    }

    // Format check: alphanumeric and hyphens only (UUID-like or base62)
    const validPattern = /^[a-zA-Z0-9-]+$/;

    if (!validPattern.test(id)) {
        console.warn(`Invalid job ID format: ${id}`);
        return null;
    }

    // Path traversal check
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
        console.error(`Path traversal attempt in job ID: ${id}`);
        return null;
    }

    return id;
}

/**
 * Validate cohort ID format
 *
 * Cohort IDs use the same format as job IDs.
 *
 * @param {string} id - Cohort ID from URL or user input
 * @returns {string|null} - Valid ID or null if invalid
 *
 * @example
 * const cohortId = validateCohortId(urlParams.get('cohort_id'));
 * if (cohortId) {
 *   loadCohortFromURL(cohortId);
 * }
 */
export function validateCohortId(id) {
    // Same validation as job ID
    return validateJobId(id);
}

/**
 * Validate email format
 *
 * RFC 5322 compliant email validation (simplified).
 *
 * @param {string} email - Email address
 * @returns {string|null} - Valid email or null if invalid
 *
 * @example
 * const email = validateEmail(input.value);
 * if (!email) {
 *   displayError('Invalid email format');
 * }
 */
export function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return null;
    }

    // RFC 5322 compliant (simplified)
    const emailPattern = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!emailPattern.test(email) || email.length > 254) {
        console.warn(`Invalid email format: ${email}`);
        return null;
    }

    return email;
}

/**
 * Sanitize filename to prevent path traversal
 *
 * @param {string} filename - Filename from user input
 * @returns {string|null} - Sanitized filename or null if invalid
 *
 * @example
 * const filename = sanitizeFilename(file.name);
 * if (!filename) {
 *   displayError('Invalid filename');
 * }
 */
export function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        return null;
    }

    // Remove path components
    filename = filename.replace(/^.*[\\\/]/, '');

    // Remove null bytes
    filename = filename.replace(/\0/g, '');

    // Check for valid filename pattern
    const validFilename = /^[a-zA-Z0-9._-]+$/;
    if (!validFilename.test(filename)) {
        console.warn(`Invalid filename: ${filename}`);
        return null;
    }

    // Max length check
    if (filename.length > 255) {
        console.warn(`Filename too long: ${filename.length} characters`);
        return null;
    }

    return filename;
}

/**
 * Validate passphrase (basic checks)
 *
 * Note: This is for temporary data retrieval, not critical authentication.
 * Just ensure it's not empty and has minimum length.
 *
 * @param {string} passphrase - Passphrase from user input
 * @returns {string|null} - Valid passphrase or null if invalid
 *
 * @example
 * const passphrase = validatePassphrase(input.value);
 * if (!passphrase) {
 *   displayError('Passphrase must be at least 8 characters');
 * }
 */
export function validatePassphrase(passphrase) {
    if (!passphrase || typeof passphrase !== 'string') {
        return null;
    }

    const trimmed = passphrase.trim();

    // Minimum length check
    if (trimmed.length < 8) {
        console.warn('Passphrase too short (minimum 8 characters)');
        return null;
    }

    // Maximum length check (prevent DOS)
    if (trimmed.length > 128) {
        console.warn('Passphrase too long (maximum 128 characters)');
        return null;
    }

    return trimmed;
}

/**
 * Validate and sanitize cohort alias
 *
 * @param {string} alias - Cohort alias from user input
 * @returns {string|null} - Valid alias or null if invalid
 *
 * @example
 * const alias = validateCohortAlias(input.value);
 * if (alias) {
 *   formData.append('cohort_alias', alias);
 * }
 */
export function validateCohortAlias(alias) {
    if (!alias || typeof alias !== 'string') {
        return null;
    }

    const trimmed = alias.trim();

    // Length check (3-64 chars)
    if (trimmed.length < 3 || trimmed.length > 64) {
        console.warn(`Invalid cohort alias length: ${trimmed.length} (expected 3-64)`);
        return null;
    }

    // Allow alphanumeric, spaces, hyphens, underscores
    const validPattern = /^[a-zA-Z0-9 _-]+$/;
    if (!validPattern.test(trimmed)) {
        console.warn(`Invalid cohort alias format: ${trimmed}`);
        return null;
    }

    return trimmed;
}