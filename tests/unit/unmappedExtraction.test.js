// tests/unit/unmappedExtraction.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mergeBamFiles, validateBamFile } from '../../resources/js/unmappedExtraction.js';

// Mock the log module
vi.mock('../../resources/js/log.js', () => ({
  logMessage: vi.fn(),
}));

/**
 * Note: extractUnmappedReads uses BGZF parsing with pako and requires real File objects
 * with arrayBuffer() method and actual BAI/BAM binary data. Testing this requires
 * complex binary fixtures and is better suited for integration tests.
 *
 * These unit tests focus on:
 * - mergeBamFiles: Uses samtools via CLI.exec
 * - validateBamFile: Simple file stat check
 */

describe('unmappedExtraction', () => {
  let mockCLI;

  beforeEach(() => {
    // Create a mock Aioli CLI object
    mockCLI = {
      exec: vi.fn(),
      fs: {
        stat: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // mergeBamFiles - Uses samtools merge via CLI
  // ============================================================================

  describe('mergeBamFiles', () => {
    it('should successfully merge BAM files', async () => {
      mockCLI.exec.mockResolvedValue('');
      mockCLI.fs.stat.mockResolvedValue({
        size: 1024 * 1024 * 10, // 10 MB
      });

      const result = await mergeBamFiles(mockCLI, ['region.bam', 'unmapped.bam'], 'merged.bam');

      expect(result).toMatchObject({
        path: 'merged.bam',
        size: 1024 * 1024 * 10,
      });

      expect(mockCLI.exec).toHaveBeenCalledWith('samtools', [
        'merge',
        '-f',
        'merged.bam',
        'region.bam',
        'unmapped.bam',
      ]);
    });

    it('should throw error if less than 2 input files', async () => {
      await expect(mergeBamFiles(mockCLI, ['only-one.bam'], 'merged.bam')).rejects.toThrow(
        'requires at least 2 input files'
      );
    });

    it('should throw error if no input files', async () => {
      await expect(mergeBamFiles(mockCLI, [], 'merged.bam')).rejects.toThrow(
        'requires at least 2 input files'
      );
    });

    it('should throw error if input is null', async () => {
      await expect(mergeBamFiles(mockCLI, null, 'merged.bam')).rejects.toThrow(
        'requires at least 2 input files'
      );
    });

    it('should throw error if output is empty', async () => {
      mockCLI.exec.mockResolvedValue('');
      mockCLI.fs.stat.mockResolvedValue({ size: 0 });

      await expect(
        mergeBamFiles(mockCLI, ['file1.bam', 'file2.bam'], 'merged.bam')
      ).rejects.toThrow('is empty');
    });

    it('should throw error if samtools merge fails', async () => {
      mockCLI.exec.mockRejectedValue(new Error('merge failed'));

      await expect(
        mergeBamFiles(mockCLI, ['file1.bam', 'file2.bam'], 'merged.bam')
      ).rejects.toThrow('Failed to merge BAM files');
    });

    it('should throw error if stat fails after merge', async () => {
      mockCLI.exec.mockResolvedValue('');
      mockCLI.fs.stat.mockRejectedValue(new Error('File not found'));

      await expect(
        mergeBamFiles(mockCLI, ['file1.bam', 'file2.bam'], 'merged.bam')
      ).rejects.toThrow('Failed to merge BAM files');
    });

    it('should handle merging multiple files', async () => {
      mockCLI.exec.mockResolvedValue('');
      mockCLI.fs.stat.mockResolvedValue({
        size: 1024 * 1024 * 20,
      });

      const result = await mergeBamFiles(
        mockCLI,
        ['file1.bam', 'file2.bam', 'file3.bam'],
        'merged.bam'
      );

      expect(result.size).toBe(1024 * 1024 * 20);
      expect(mockCLI.exec).toHaveBeenCalledWith('samtools', [
        'merge',
        '-f',
        'merged.bam',
        'file1.bam',
        'file2.bam',
        'file3.bam',
      ]);
    });

    it('should track elapsed time', async () => {
      mockCLI.exec.mockResolvedValue('');
      mockCLI.fs.stat.mockResolvedValue({ size: 1024 });

      const result = await mergeBamFiles(mockCLI, ['file1.bam', 'file2.bam'], 'merged.bam');

      expect(result.elapsedTime).toBeDefined();
      expect(typeof result.elapsedTime).toBe('string');
      expect(result.elapsedTime).toMatch(/^\d+\.\d+s$/);
    });

    it('should format size correctly', async () => {
      mockCLI.exec.mockResolvedValue('');
      mockCLI.fs.stat.mockResolvedValue({ size: 5242880 }); // 5 MB

      const result = await mergeBamFiles(mockCLI, ['file1.bam', 'file2.bam'], 'merged.bam');

      expect(result.sizeFormatted).toBe('5.00 MB');
    });
  });

  // ============================================================================
  // validateBamFile - Simple file stat validation
  // ============================================================================

  describe('validateBamFile', () => {
    it('should return true for valid BAM file with size > 0', async () => {
      mockCLI.fs.stat.mockResolvedValue({ size: 1024 });

      const result = await validateBamFile(mockCLI, 'valid.bam');

      expect(result).toBe(true);
      expect(mockCLI.fs.stat).toHaveBeenCalledWith('valid.bam');
    });

    it('should return false for empty BAM file (size = 0)', async () => {
      mockCLI.fs.stat.mockResolvedValue({ size: 0 });

      const result = await validateBamFile(mockCLI, 'empty.bam');

      expect(result).toBe(false);
    });

    it('should return false if file does not exist (stat throws)', async () => {
      mockCLI.fs.stat.mockRejectedValue(new Error('ENOENT'));

      const result = await validateBamFile(mockCLI, 'missing.bam');

      expect(result).toBe(false);
    });

    it('should return false if stat returns null', async () => {
      mockCLI.fs.stat.mockResolvedValue(null);

      const result = await validateBamFile(mockCLI, 'null.bam');

      // stats && stats.size > 0 evaluates to null when stats is null
      expect(result).toBeFalsy();
    });

    it('should return false if stat returns undefined', async () => {
      mockCLI.fs.stat.mockResolvedValue(undefined);

      const result = await validateBamFile(mockCLI, 'undefined.bam');

      // stats && stats.size > 0 evaluates to undefined when stats is undefined
      expect(result).toBeFalsy();
    });

    it('should return false if stat returns object without size', async () => {
      mockCLI.fs.stat.mockResolvedValue({});

      const result = await validateBamFile(mockCLI, 'no-size.bam');

      expect(result).toBeFalsy();
    });

    it('should return true for large file', async () => {
      mockCLI.fs.stat.mockResolvedValue({ size: 1024 * 1024 * 100 }); // 100 MB

      const result = await validateBamFile(mockCLI, 'large.bam');

      expect(result).toBe(true);
    });
  });
});
