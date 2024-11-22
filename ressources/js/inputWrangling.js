// frontend/ressources/js/inputWrangling.js

/**
 * Validates the selected BAM and BAI files.
 * @param {File[]} selectedFiles - Array of selected File objects.
 * @param {boolean} logWarnings - Whether to log warnings for invalid files.
 * @returns {Object} - Contains matchedPairs and invalidFiles arrays.
 */
export function validateFiles(selectedFiles, logWarnings = true) {
    // Convert all file names to lowercase for case-insensitive matching
    const lowerCaseFiles = selectedFiles.map(file => ({
        originalFile: file,
        lowerCaseName: file.name.toLowerCase()
    }));

    // Filter BAM and BAI files
    const bamFiles = lowerCaseFiles.filter(file => file.lowerCaseName.endsWith(".bam"));
    const baiFiles = lowerCaseFiles.filter(file => file.lowerCaseName.endsWith(".bai"));

    // Initialize arrays to hold matched pairs and invalid files
    const matchedPairs = [];
    const invalidFiles = [];

    // Map to track BAI files for quick lookup
    const baiMap = new Map();
    baiFiles.forEach(bai => {
        const baseName = getBaseName(bai.lowerCaseName, 'bai');
        baiMap.set(baseName, bai);
    });

    // Iterate through BAM files to find corresponding BAI files
    bamFiles.forEach(bam => {
        const baseName = getBaseName(bam.lowerCaseName, 'bam');
        const bai = baiMap.get(baseName);
        if (bai) {
            matchedPairs.push({ bam: bam.originalFile, bai: bai.originalFile });
            baiMap.delete(baseName); // Remove from map once matched
        } else {
            invalidFiles.push(bam.originalFile);
            if (logWarnings) {
                console.warn(`Corresponding BAI file not found for BAM file: ${bam.originalFile.name}`);
            }
        }
    });

    // Any remaining BAI files without corresponding BAM files are invalid
    baiMap.forEach((bai, baseName) => {
        invalidFiles.push(bai.originalFile);
        if (logWarnings) {
            console.warn(`Corresponding BAM file not found for BAI file: ${bai.originalFile.name}`);
        }
    });

    return { matchedPairs, invalidFiles };
}

/**
 * Extracts the base name of a file by removing the extension.
 * Handles both `.bam` and `.bam.bai` extensions.
 * @param {string} fileName - The lowercase name of the file.
 * @param {string} fileType - The type of file ('bam' or 'bai').
 * @returns {string} - The base name of the file.
 */
function getBaseName(fileName, fileType) {
    if (fileType === 'bai') {
        // Handles both `.bam.bai` and `.bai` at the end of the string
        return fileName.replace(/\.bam\.bai$/i, '').replace(/\.bai$/i, '');
    } else if (fileType === 'bam') {
        // Handles `.bam` at the end of the string
        return fileName.replace(/\.bam$/i, '');
    }
    return fileName;
}
