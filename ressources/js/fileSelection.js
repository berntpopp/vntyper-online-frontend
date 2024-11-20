// frontend/ressources/js/fileSelection.js

import { validateFiles } from './inputWrangling.js';
import { displayError, clearError } from './errorHandling.js';

export function initializeFileSelection(selectedFiles) {
    const dropArea = document.getElementById('dropArea');
    const bamFilesInput = document.getElementById('bamFiles');
    const fileList = document.getElementById('fileList');

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
                removeBtn.addEventListener('click', () => {
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

    function removeFile(index) {
        selectedFiles.splice(index, 1);
        displaySelectedFiles();
    }

    function handleFileSelection(files) {
        const filesArray = Array.from(files);
        const { matchedPairs, invalidFiles } = validateFiles(filesArray, false);

        // Add matched pairs to selectedFiles, ensuring no duplicates
        matchedPairs.forEach(pair => {
            if (!selectedFiles.some(f => f.name === pair.bam.name && f.size === pair.bam.size)) {
                selectedFiles.push(pair.bam);
            }
            if (pair.bai && !selectedFiles.some(f => f.name === pair.bai.name && f.size === pair.bai.size)) {
                selectedFiles.push(pair.bai);
            }
        });

        // Handle invalid files
        if (invalidFiles.length > 0) {
            displayError(`Some files were invalid and not added: ${invalidFiles.map(f => f.name).join(', ')}`);
        } else {
            clearError();
        }

        displaySelectedFiles();
    }

    // Drag & Drop Events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
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

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            handleFileSelection(files);
        }
    }

    // File Selection via Click
    bamFilesInput.addEventListener('change', () => {
        const files = bamFilesInput.files;
        if (files && files.length > 0) {
            handleFileSelection(files);
        }
    });

    return {
        displaySelectedFiles
    };
}
