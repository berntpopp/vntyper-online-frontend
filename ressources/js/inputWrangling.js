// frontend/ressources/js/inputWrangling.js

/**
 * Validates the selected BAM and BAI files.
 * @param {File[]} selectedFiles - Array of selected File objects.
 * @returns {Object} - Contains matchedPairs.
 * @throws {Error} - If validation fails.
 */
export function validateFiles(selectedFiles) {
    const bamFiles = selectedFiles.filter(file => file.name.endsWith(".bam"));
    const baiFiles = selectedFiles.filter(file => file.name.endsWith(".bai"));

    if (bamFiles.length === 0) {
        throw new Error("No BAM files selected.");
    }

    // Match BAM files with their corresponding BAI files
    const matchedPairs = bamFiles.map(bam => {
        const baseName = bam.name.replace(/\.bam$/, '');
        const correspondingBai = baiFiles.find(bai => bai.name === `${baseName}.bai` || bai.name === `${baseName}.bam.bai`);
        return { bam, bai: correspondingBai };
    });

    // Check for unmatched BAM files
    const unmatched = matchedPairs.filter(pair => !pair.bai);
    if (unmatched.length > 0) {
        const unmatchedNames = unmatched.map(pair => pair.bam.name).join(', ');
        throw new Error(`Corresponding BAI file not found for: ${unmatchedNames}. Please ensure each BAM file has a matching BAI file (e.g., test.bam.bai or test.bai).`);
    }

    return { matchedPairs };
}
