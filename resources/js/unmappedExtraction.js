// resources/js/unmappedExtraction.js

/**
 * Unmapped Reads Extraction Module
 *
 * This module provides utilities for extracting unmapped reads from BAM files
 * and merging them with region-specific extractions. This implements the
 * "normal mode" functionality matching the Python backend behavior.
 *
 * Python equivalent: vntyper/scripts/extract_unmapped_from_offset.py
 *
 * @module unmappedExtraction
 */

import { logMessage } from './log.js';

/**
 * Extracts unmapped reads from a BAM file using samtools
 *
 * Equivalent to Python:
 *   samtools view -b -f 4 input.bam -o unmapped.bam
 *
 * The flag `-f 4` means:
 *   4 = 0x4 = BAM_FUNMAP = read is unmapped
 *
 * @param {Aioli} CLI - The initialized Aioli CLI object
 * @param {string} bamPath - Path to the BAM file in virtual filesystem
 * @param {string} outputPath - Path for the output unmapped BAM
 * @returns {Promise<Object>} - Object containing { path, size, count }
 * @throws {Error} If samtools execution fails
 *
 * @example
 * const result = await extractUnmappedReads(CLI, 'input.bam', 'unmapped.bam');
 * console.log(`Extracted ${result.count} unmapped reads`);
 */
export async function extractUnmappedReads(CLI, bamPath, outputPath) {
    const startTime = performance.now();
    logMessage(`📤 Extracting unmapped reads from ${bamPath}...`, 'info');

    // Build samtools command
    // -b = output BAM format
    // -f 4 = filter reads WITH flag 0x4 (unmapped)
    const viewArgs = ['view', '-b', '-f', '4', bamPath, '-o', outputPath];
    const commandStr = `samtools ${viewArgs.join(' ')}`;

    logMessage(`Executing: ${commandStr}`, 'info');

    try {
        // Execute samtools view to extract unmapped reads
        const result = await CLI.exec('samtools', viewArgs);

        // Log samtools output (usually empty on success)
        if (result && result.trim()) {
            logMessage(`Samtools output: ${result}`, 'info');
        }

        // Verify output file was created and get stats
        let stats;
        try {
            stats = await CLI.fs.stat(outputPath);
        } catch (statError) {
            throw new Error(`Output file ${outputPath} was not created`);
        }

        const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);
        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

        // Check if file is empty (no unmapped reads)
        if (stats.size === 0) {
            logMessage(`⚠️ No unmapped reads found in ${bamPath} (0 bytes)`, 'warning');
            return {
                path: outputPath,
                size: 0,
                sizeFormatted: '0 MB',
                count: 0,
                isEmpty: true,
                elapsedTime
            };
        }

        // Count reads in the unmapped BAM (optional, for logging)
        // This is a separate samtools command: samtools view -c
        let readCount = 'unknown';
        try {
            const countResult = await CLI.exec('samtools', ['view', '-c', outputPath]);
            readCount = parseInt(countResult.trim(), 10);
        } catch (countError) {
            logMessage(`Could not count reads in ${outputPath}: ${countError.message}`, 'warning');
        }

        logMessage(
            `✅ Extracted ${readCount} unmapped reads: ${fileSizeMB} MB in ${elapsedTime}s`,
            'success'
        );

        return {
            path: outputPath,
            size: stats.size,
            sizeFormatted: `${fileSizeMB} MB`,
            count: readCount,
            isEmpty: false,
            elapsedTime
        };

    } catch (error) {
        const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);
        logMessage(`❌ Error extracting unmapped reads: ${error.message}`, 'error');
        logMessage(`Failed after ${elapsedTime}s`, 'error');
        throw new Error(`Failed to extract unmapped reads from ${bamPath}: ${error.message}`);
    }
}

/**
 * Merges multiple BAM files using samtools merge
 *
 * Equivalent to Python:
 *   samtools merge -f output.bam input1.bam input2.bam ...
 *
 * The flag `-f` means:
 *   Force overwrite if output file exists
 *
 * @param {Aioli} CLI - The initialized Aioli CLI object
 * @param {string[]} inputPaths - Array of BAM file paths to merge (must be >= 2)
 * @param {string} outputPath - Path for the merged output BAM
 * @returns {Promise<Object>} - Object containing { path, size }
 * @throws {Error} If samtools execution fails or input validation fails
 *
 * @example
 * const result = await mergeBamFiles(CLI, ['region.bam', 'unmapped.bam'], 'merged.bam');
 * console.log(`Merged file size: ${result.sizeFormatted}`);
 */
export async function mergeBamFiles(CLI, inputPaths, outputPath) {
    const startTime = performance.now();

    // Validate inputs
    if (!inputPaths || inputPaths.length < 2) {
        throw new Error(`mergeBamFiles requires at least 2 input files, got ${inputPaths?.length || 0}`);
    }

    logMessage(`🔗 Merging ${inputPaths.length} BAM files...`, 'info');
    logMessage(`  Inputs: ${inputPaths.join(', ')}`, 'info');
    logMessage(`  Output: ${outputPath}`, 'info');

    // Build samtools command
    // -f = force overwrite output
    const mergeArgs = ['merge', '-f', outputPath, ...inputPaths];
    const commandStr = `samtools ${mergeArgs.join(' ')}`;

    logMessage(`Executing: ${commandStr}`, 'info');

    try {
        // Execute samtools merge
        const result = await CLI.exec('samtools', mergeArgs);

        // Log samtools output (usually empty on success)
        if (result && result.trim()) {
            logMessage(`Samtools merge output: ${result}`, 'info');
        }

        // Verify merged file was created and get stats
        let stats;
        try {
            stats = await CLI.fs.stat(outputPath);
        } catch (statError) {
            throw new Error(`Merged file ${outputPath} was not created`);
        }

        const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);
        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

        if (stats.size === 0) {
            throw new Error(`Merged BAM file ${outputPath} is empty (0 bytes)`);
        }

        logMessage(
            `✅ Merged BAM created: ${fileSizeMB} MB in ${elapsedTime}s`,
            'success'
        );

        return {
            path: outputPath,
            size: stats.size,
            sizeFormatted: `${fileSizeMB} MB`,
            elapsedTime
        };

    } catch (error) {
        const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);
        logMessage(`❌ Error merging BAM files: ${error.message}`, 'error');
        logMessage(`Failed after ${elapsedTime}s`, 'error');
        throw new Error(`Failed to merge BAM files: ${error.message}`);
    }
}

/**
 * Validates that a BAM file exists in the virtual filesystem
 *
 * @param {Aioli} CLI - The initialized Aioli CLI object
 * @param {string} bamPath - Path to check
 * @returns {Promise<boolean>} - True if file exists and has size > 0
 */
export async function validateBamFile(CLI, bamPath) {
    try {
        const stats = await CLI.fs.stat(bamPath);
        return stats && stats.size > 0;
    } catch (error) {
        return false;
    }
}
