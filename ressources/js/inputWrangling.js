// frontend/ressources/js/inputWrangling.js

/**
 * Validates the selected BAM and BAI files.
 * @param {File[]} selectedFiles - Array of selected File objects.
 * @param {boolean} logWarnings - Whether to log warnings for invalid files.
 * @returns {Object} - Contains matchedPairs and invalidFiles arrays.
 */
export function validateFiles(selectedFiles, logWarnings = true) {
    // Filter BAM and BAI files
    const bamFiles = selectedFiles.filter(file => file.name.endsWith(".bam"));
    const baiFiles = selectedFiles.filter(file => file.name.endsWith(".bai"));

    // Initialize arrays to hold matched pairs and invalid files
    const matchedPairs = [];
    const invalidFiles = [];

    // Map to track BAI files for quick lookup
    const baiMap = new Map();
    baiFiles.forEach(bai => {
        const baseName = getBaseName(bai.name, 'bai');
        baiMap.set(baseName, bai);
    });

    // Iterate through BAM files to find corresponding BAI files
    bamFiles.forEach(bam => {
        const baseName = getBaseName(bam.name, 'bam');
        const bai = baiMap.get(baseName);
        if (bai) {
            matchedPairs.push({ bam, bai });
            baiMap.delete(baseName); // Remove from map once matched
        } else {
            invalidFiles.push(bam);
            if (logWarnings) {
                console.warn(`Corresponding BAI file not found for BAM file: ${bam.name}`);
            }
        }
    });

    // Any remaining BAI files without corresponding BAM files are invalid
    baiMap.forEach((bai, baseName) => {
        invalidFiles.push(bai);
        if (logWarnings) {
            console.warn(`Corresponding BAM file not found for BAI file: ${bai.name}`);
        }
    });

    return { matchedPairs, invalidFiles };
}

/**
 * Extracts the base name of a file by removing the extension.
 * Handles both `.bam` and `.bam.bai` extensions.
 * @param {string} fileName - The name of the file.
 * @param {string} fileType - The type of file ('bam' or 'bai').
 * @returns {string} - The base name of the file.
 */
function getBaseName(fileName, fileType) {
    if (fileType === 'bai') {
        // Handles both `.bai` and `.bam.bai`
        return fileName.replace(/\.bam\.bai$|\.bai$/, '');
    } else if (fileType === 'bam') {
        return fileName.replace(/\.bam$/, '');
    }
    return fileName;
}
