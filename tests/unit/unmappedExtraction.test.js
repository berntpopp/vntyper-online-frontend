// tests/unit/unmappedExtraction.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractUnmappedReads,
  mergeBamFiles,
  validateBamFile,
  MAX_UNPLACED_BYTES,
} from '../../resources/js/unmappedExtraction.js';

// Mock the log module
vi.mock('../../resources/js/log.js', () => ({
  logMessage: vi.fn(),
}));

const hasSamtools = (() => {
  try {
    execFileSync('samtools', ['--version']);
    return true;
  } catch {
    return false;
  }
})();

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

  // ============================================================================
  // extractUnmappedReads - samtools view '*' (unplaced unmapped block)
  // ============================================================================

  describe('extractUnmappedReads', () => {
    it("requests the unplaced block with samtools view '*'", async () => {
      mockCLI.exec.mockResolvedValueOnce('').mockResolvedValueOnce('42\n');
      mockCLI.fs.stat.mockResolvedValue({ size: 2048 });

      const result = await extractUnmappedReads(mockCLI, '/data/s.bam', 'u.bam');

      expect(mockCLI.exec).toHaveBeenNthCalledWith(1, 'samtools', [
        'view',
        '-b',
        '-o',
        'u.bam',
        '/data/s.bam',
        '*',
      ]);
      expect(result).toMatchObject({ path: 'u.bam', size: 2048, count: 42, isEmpty: false });
    });

    it('reports an empty block', async () => {
      mockCLI.exec.mockResolvedValueOnce('').mockResolvedValueOnce('0\n');
      mockCLI.fs.stat.mockResolvedValue({ size: 100 });

      const result = await extractUnmappedReads(mockCLI, 's.bam', 'u.bam');

      expect(result.isEmpty).toBe(true);
    });

    it('rejects a block over the upload limit', async () => {
      mockCLI.exec.mockResolvedValue('');
      mockCLI.fs.stat.mockResolvedValue({ size: MAX_UNPLACED_BYTES + 1 });

      await expect(extractUnmappedReads(mockCLI, 's.bam', 'u.bam')).rejects.toThrow(
        'exceed the upload limit'
      );
    });

    it.skipIf(!hasSamtools)(
      'returns exactly the unplaced reads of samtools view -f 4',
      async () => {
        const dir = mkdtempSync(join(tmpdir(), 'unplaced-'));
        try {
          const seq = 'ACGTACGTAC';
          const qual = 'IIIIIIIIII';
          const sam = [
            '@HD\tVN:1.6\tSO:coordinate',
            '@SQ\tSN:chr1\tLN:1000',
            '@SQ\tSN:chr2\tLN:1000',
            `mapped\t99\tchr1\t100\t60\t10M\t=\t300\t210\t${seq}\t${qual}`,
            `mateplaced\t73\tchr1\t200\t60\t10M\t=\t200\t0\t${seq}\t${qual}`,
            `mateplaced\t133\tchr1\t200\t0\t*\t=\t200\t0\t${seq}\t${qual}`,
            `mapped\t147\tchr1\t300\t60\t10M\t=\t100\t-210\t${seq}\t${qual}`,
            `last\t0\tchr2\t500\t60\t10M\t*\t0\t0\t${seq}\t${qual}`,
            `unplacedA\t77\t*\t0\t0\t*\t*\t0\t0\t${seq}\t${qual}`,
            `unplacedA\t141\t*\t0\t0\t*\t*\t0\t0\t${seq}\t${qual}`,
            `unplacedB\t4\t*\t0\t0\t*\t*\t0\t0\t${seq}\t${qual}`,
          ].join('\n');
          const bam = join(dir, 'in.bam');
          writeFileSync(join(dir, 'in.sam'), `${sam}\n`);
          execFileSync('samtools', ['view', '-b', '-o', bam, join(dir, 'in.sam')]);
          execFileSync('samtools', ['index', bam]);

          // Node stand-in for the Aioli CLI: same exec/fs.stat surface, real samtools.
          const cli = {
            exec: async (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }),
            fs: { stat: async p => statSync(p) },
          };
          const out = join(dir, 'u.bam');
          const result = await extractUnmappedReads(cli, bam, out);

          const reads = file =>
            execFileSync('samtools', ['view', file], { encoding: 'utf8' })
              .trim()
              .split('\n')
              .map(l => l.split('\t'))
              .filter(f => f[2] === '*')
              .map(f => `${f[0]}/${f[1]}`)
              .sort();
          const expected = execFileSync('samtools', ['view', '-f', '4', bam], { encoding: 'utf8' })
            .trim()
            .split('\n')
            .map(l => l.split('\t'))
            .filter(f => f[2] === '*')
            .map(f => `${f[0]}/${f[1]}`)
            .sort();

          expect(expected).toEqual(['unplacedA/141', 'unplacedA/77', 'unplacedB/4']);
          expect(reads(out)).toEqual(expected);
          expect(result.count).toBe(3);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
    );
  });
});
