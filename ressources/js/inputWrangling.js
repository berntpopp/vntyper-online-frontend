// frontend/ressources/js/inputWrangling.js

/**
 * Validates the selected BAM and BAI files.
 * @param {FileList} fileList - The list of selected files from the input.
 * @returns {Object} - Contains matchedPairs.
 * @throws {Error} - If validation fails.
 */
function validateFiles(fileList) {
    const files = Array.from(fileList);
    const bamFiles = files.filter(file => file.name.endsWith(".bam"));
    const baiFiles = files.filter(file => file.name.endsWith(".bai"));

    if (bamFiles.length === 0) {
        throw new Error("No BAM files selected.");
    }

    // Match BAM files with their corresponding BAI files
    const matchedPairs = bamFiles.map(bam => {
        const baseName = bam.name.slice(0, -4); // Remove '.bam'

        // Possible BAI file names
        const baiName1 = `${baseName}.bai`; // e.g., 'sample.bai'
        const baiName2 = `${bam.name}.bai`; // e.g., 'sample.bam.bai'

        // Find BAI file with either name
        const correspondingBai = baiFiles.find(bai => bai.name === baiName1 || bai.name === baiName2);

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

// Export the function for use in other modules
export { validateFiles };
