// frontend/ressources/js/fileSelection.js

import { validateFiles } from './inputWrangling.js';
import { displayError, clearError } from './errorHandling.js';
import { showSpinner, hideSpinner } from './uiUtils.js';

export function initializeFileSelection(selectedFiles) {
    const dropArea = document.getElementById('dropArea');
    const bamFilesInput = document.getElementById('bamFiles');
    const fileList = document.getElementById('fileList');

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
     * Handles the file validation and UI updating when files are selected.
     * Shows a spinner immediately and uses setTimeout to ensure the UI updates before processing.
     * After processing completes, hides the spinner.
     * @param {FileList|File[]} files - The files selected or dropped by the user.
     */
    function handleFileSelection(files) {
        // Show spinner immediately when file selection starts
        showSpinner();

        // Use setTimeout to allow the UI thread to update (show the spinner) before processing
        setTimeout(() => {
            const filesArray = Array.from(files);
            const { matchedPairs, invalidFiles } = validateFiles(filesArray, false);

            // Add matched pairs to selectedFiles if not already present
            matchedPairs.forEach((pair) => {
                if (!selectedFiles.some((f) => f.name === pair.bam.name && f.size === pair.bam.size)) {
                    selectedFiles.push(pair.bam);
                }
                if (
                    pair.bai &&
                    !selectedFiles.some((f) => f.name === pair.bai.name && f.size === pair.bai.size)
                ) {
                    selectedFiles.push(pair.bai);
                }
            });

            // Handle invalid files
            if (invalidFiles.length > 0) {
                displayError(`Some files were invalid and not added: ${invalidFiles.map((f) => f.name).join(', ')}`);
            } else {
                clearError();
            }

            displaySelectedFiles();

            // Hide spinner after processing is complete
            hideSpinner();
        }, 0);
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
