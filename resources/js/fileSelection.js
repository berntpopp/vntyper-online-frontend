// frontend/resources/js/fileSelection.js

import { validateFiles } from './inputWrangling.js';
import { displayError, clearError } from './errorHandling.js';
import { showSpinner, hideSpinner } from './uiUtils.js';

export function initializeFileSelection(selectedFiles) {
    const dropArea = document.getElementById('dropArea');
    const bamFilesInput = document.getElementById('bamFiles');
    const fileList = document.getElementById('fileList');

    // Debounce timer for file validation (Performance: smooth UX with 100+ files)
    let validationTimeout = null;

    /**
     * Updates the UI to show the selected files.
     */
    function displaySelectedFiles() {
        fileList.innerHTML = '';
        if (selectedFiles.length > 0) {
            const ul = document.createElement('ul');
            selectedFiles.forEach((file, index) => {
                const li = document.createElement('li');

                const fileNameSpan = document.createElement('span');
                fileNameSpan.textContent = file.name;
                fileNameSpan.classList.add('file-name');

                const removeBtn = document.createElement('button');
                removeBtn.textContent = '×';
                removeBtn.classList.add('remove-file');
                removeBtn.setAttribute('aria-label', `Remove ${file.name}`);

                // FIX: Stop event propagation to avoid triggering the file selector
                removeBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    removeFile(index);
                });

                li.appendChild(fileNameSpan);
                li.appendChild(removeBtn);
                ul.appendChild(li);
            });
            fileList.appendChild(ul);
        } else {
            fileList.innerHTML = '<p>No files selected.</p>';
        }
    }

    /**
     * Removes a file from the selected files list by index.
     * @param {number} index - Index of the file to remove.
     */
    function removeFile(index) {
        selectedFiles.splice(index, 1);
        displaySelectedFiles();
    }

    /**
     * Processes file validation (called after debounce delay)
     * @private
     * @param {FileList|File[]} files - The files to validate
     */
    function processFileValidation(files) {
        const filesArray = Array.from(files);
        const { matchedPairs, invalidFiles } = validateFiles(filesArray, false);

        // Add matched pairs to selectedFiles if not already present.
        // For SAM files, use pair.sam; for BAM files, use pair.bam (and add bai if available).
        matchedPairs.forEach((pair) => {
            if (pair.sam) {
                if (!selectedFiles.some((f) => f.name === pair.sam.name && f.size === pair.sam.size)) {
                    selectedFiles.push(pair.sam);
                }
            } else if (pair.bam) {
                if (!selectedFiles.some((f) => f.name === pair.bam.name && f.size === pair.bam.size)) {
                    selectedFiles.push(pair.bam);
                }
                if (pair.bai &&
                    !selectedFiles.some((f) => f.name === pair.bai.name && f.size === pair.bai.size)
                ) {
                    selectedFiles.push(pair.bai);
                }
            }
        });

        // Handle invalid files
        if (invalidFiles.length > 0) {
            displayError(`Some files were invalid and not added: ${invalidFiles.map((f) => f.name).join(', ')}`);
        } else {
            clearError();
        }

        displaySelectedFiles();
        hideSpinner();
    }

    /**
     * Handles the file validation and UI updating when files are selected.
     * Uses debouncing (300ms) for smooth UX with 100+ files.
     * Shows immediate feedback, then validates after delay.
     * @param {FileList|File[]} files - The files selected or dropped by the user.
     */
    function handleFileSelection(files) {
        // Clear any pending validation
        clearTimeout(validationTimeout);

        // Show immediate feedback
        showSpinner();
        fileList.innerHTML = '<p>Processing files...</p>';

        // Debounce validation (300ms delay)
        // This prevents UI freezing when selecting many files
        validationTimeout = setTimeout(() => {
            processFileValidation(files);
        }, 300);
    }

    // Drag & Drop events setup
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach((eventName) => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('dragover');
        }, false);
    });

    dropArea.addEventListener('drop', handleDrop, false);
    dropArea.addEventListener('click', () => bamFilesInput.click());
    dropArea.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            bamFilesInput.click();
        }
    });

    /**
     * Handles the drop event from drag & drop functionality.
     * @param {DragEvent} e - The drop event.
     */
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            handleFileSelection(files);
        }
    }

    // File selection via click
    bamFilesInput.addEventListener('change', () => {
        const files = bamFilesInput.files;
        if (files && files.length > 0) {
            handleFileSelection(files);
        }
    });

    /**
     * Resets the file selection entirely by clearing the array,
     * resetting the hidden input value, and updating the UI.
     */
    function resetFileSelection() {
        selectedFiles.length = 0;
        bamFilesInput.value = '';
        displaySelectedFiles();
    }

    return {
        displaySelectedFiles,
        resetFileSelection
    };
}
