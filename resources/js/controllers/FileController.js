// frontend/resources/js/controllers/FileController.js

import { BaseController } from './BaseController.js';
import { validateFiles } from '../inputWrangling.js';

/**
 * File Controller - Handles file selection and validation
 *
 * Purpose: Manages file selection, validation, and preparation for job submission.
 *
 * Responsibilities:
 * - File selection handling
 * - BAM/BAI pair validation
 * - File list management
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles file operations
 * - Open/Closed: Easy to extend with new file types
 * - Dependency Inversion: Depends on abstractions
 *
 * @class FileController
 * @extends BaseController
 */
export class FileController extends BaseController {
  /**
   * @param {Object} dependencies - Injected dependencies
   */
  constructor(dependencies) {
    super(dependencies);

    this.errorView = dependencies.errorView;
    this.selectedFiles = dependencies.selectedFiles || [];
    this.fileSelection = dependencies.fileSelection;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    this.on('files:selected', this.handleFilesSelected);
    this.on('files:validate', this.handleValidation);
    this.on('files:clear', this.handleClear);
  }

  /**
   * Handle file selection
   * @param {Object} params - Selection parameters
   * @param {FileList|File[]} params.files - Selected files
   */
  handleFilesSelected({ files }) {
    try {
      this._log(`Files selected: ${files.length}`, 'info');

      // Note: Files are managed by fileSelection.js module
      // which updates this.selectedFiles array directly

      // Emit validation event
      this.emit('files:validate', { files: this.selectedFiles });

      this.emit('files:selected:success', { files: this.selectedFiles });
    } catch (error) {
      this.handleError(error, 'File selection failed');
      this.errorView.show(error, 'File Selection');
    }
  }

  /**
   * Handle file validation
   * @param {Object} params - Validation parameters
   * @param {File[]} params.files - Files to validate
   * @param {boolean} [params.showErrors=true] - Whether to show errors
   */
  handleValidation({ files, showErrors = true }) {
    try {
      this._log(`Validating ${files.length} files`, 'info');

      // Validate files
      const { matchedPairs, invalidFiles } = validateFiles(files, false);

      this._log(
        `Validation result: ${matchedPairs.length} pairs, ${invalidFiles.length} invalid`,
        'info'
      );

      // Show errors if requested
      if (showErrors && invalidFiles.length > 0) {
        const errorMessage = `Invalid files: ${invalidFiles.map(f => f.name).join(', ')}`;
        this.errorView.showValidation(errorMessage);
      }

      // Emit validation result
      this.emit('files:validated', {
        matchedPairs,
        invalidFiles,
        isValid: matchedPairs.length > 0,
      });

      return { matchedPairs, invalidFiles };
    } catch (error) {
      this.handleError(error, 'File validation failed');
      this.errorView.show(error, 'File Validation');
      throw error;
    }
  }

  /**
   * Handle file clearing
   */
  handleClear() {
    this._log('Clearing file selection', 'info');

    // Clear the array (shared reference)
    this.selectedFiles.length = 0;

    // Update UI
    if (this.fileSelection && this.fileSelection.displaySelectedFiles) {
      this.fileSelection.displaySelectedFiles();
    }

    // Emit clear event
    this.emit('files:cleared');
  }

  /**
   * Get selected files
   * @returns {File[]} Selected files
   */
  getSelectedFiles() {
    return this.selectedFiles;
  }

  /**
   * Get file count
   * @returns {number} Number of selected files
   */
  getFileCount() {
    const files = this.getSelectedFiles();
    return files.length;
  }

  /**
   * Check if files are selected
   * @returns {boolean} True if files are selected
   */
  hasFiles() {
    return this.getFileCount() > 0;
  }
}
