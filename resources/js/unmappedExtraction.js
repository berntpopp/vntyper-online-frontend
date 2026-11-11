// frontend/resources/js/unmappedExtraction.js

/**
 * Unplaced unmapped read extraction for normal mode.
 *
 * VNtyper normal mode uses every unmapped read of the BAM. The region slice already carries the
 * unmapped mates placed inside the region; the rest sit in the trailing unplaced ('*') block,
 * which `samtools view <bam> '*'` reads by seeking through the index, without scanning the
 * mapped reads.
 */

import { logMessage } from './log.js';

// ponytail: nginx client_max_body_size is 100M per submission (vntyper-online-backend); keep
// 10 MiB of it for the region slice and index. Read the limit from /options-config/ if it moves.
export const MAX_UNPLACED_BYTES = 90 * 1024 * 1024;

/**
 * Writes the BAM's unplaced unmapped reads (the trailing '*' block) to a new BAM.
 *
 * @param {Object} CLI - Aioli CLI with the BAM and its index mounted
 * @param {string} bamPath - Mounted path of the original BAM
 * @param {string} outputPath - Path in the virtual FS to write the unplaced reads to
 * @returns {Promise<{path: string, size: number, sizeFormatted: string, count: number,
 *   isEmpty: boolean}>} The written BAM and its read count
 * @throws {Error} If samtools fails or the block would exceed the upload limit
 */
export async function extractUnmappedReads(CLI, bamPath, outputPath) {
  await CLI.exec('samtools', ['view', '-b', '-o', outputPath, bamPath, '*']);
  const { size } = await CLI.fs.stat(outputPath);
  const sizeFormatted = `${(size / 1024 / 1024).toFixed(2)} MB`;
  if (size > MAX_UNPLACED_BYTES) {
    throw new Error(`Unplaced unmapped reads (${sizeFormatted}) exceed the upload limit`);
  }
  const count = parseInt(await CLI.exec('samtools', ['view', '-c', outputPath]), 10) || 0;
  logMessage(`✓ ${count} unplaced unmapped reads (${sizeFormatted})`, 'success');
  return { path: outputPath, size, sizeFormatted, count, isEmpty: count === 0 };
}

/**
 * Merge BAM files using samtools (still fast enough for final step)
 */
export async function mergeBamFiles(CLI, inputPaths, outputPath) {
  const startTime = performance.now();

  if (!inputPaths || inputPaths.length < 2) {
    throw new Error(`mergeBamFiles requires at least 2 input files`);
  }

  logMessage(`🔗 Merging ${inputPaths.length} BAM files...`, 'info');

  const mergeArgs = ['merge', '-f', outputPath, ...inputPaths];

  try {
    await CLI.exec('samtools', mergeArgs);

    const stats = await CLI.fs.stat(outputPath);
    const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);

    if (stats.size === 0) {
      throw new Error(`Merged BAM is empty`);
    }

    logMessage(
      `✓ Merged: ${(stats.size / 1024 / 1024).toFixed(2)} MB in ${elapsedTime}s`,
      'success'
    );

    return {
      path: outputPath,
      size: stats.size,
      sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      elapsedTime: `${elapsedTime}s`,
    };
  } catch (error) {
    logMessage(`Merge failed: ${error.message}`, 'error');
    throw new Error(`Failed to merge BAM files: ${error.message}`, { cause: error });
  }
}

/**
 * Validate BAM file
 */
export async function validateBamFile(CLI, bamPath) {
  try {
    const stats = await CLI.fs.stat(bamPath);
    return stats && stats.size > 0;
  } catch (_error) {
    return false;
  }
}
