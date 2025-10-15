// tests/unit/unmappedExtraction.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractUnmappedReads, mergeBamFiles, validateBamFile } from '../../resources/js/unmappedExtraction.js';

// Mock the log module
vi.mock('../../resources/js/log.js', () => ({
    logMessage: vi.fn()
}));

describe('unmappedExtraction', () => {
    let mockCLI;

    beforeEach(() => {
        // Create a mock Aioli CLI object
        mockCLI = {
            exec: vi.fn(),
            fs: {
                stat: vi.fn(),
                readFile: vi.fn()
            }
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('extractUnmappedReads', () => {
        it('should successfully extract unmapped reads', async () => {
            // Mock successful samtools execution
            mockCLI.exec.mockResolvedValueOnce(''); // view command
            mockCLI.exec.mockResolvedValueOnce('12345\n'); // count command

            // Mock file stats
            mockCLI.fs.stat.mockResolvedValue({
                size: 1024 * 1024 * 5 // 5 MB
            });

            const result = await extractUnmappedReads(mockCLI, 'input.bam', 'unmapped.bam');

            expect(result).toMatchObject({
                path: 'unmapped.bam',
                size: 1024 * 1024 * 5,
                count: 12345,
                isEmpty: false
            });

            expect(mockCLI.exec).toHaveBeenCalledWith('samtools', ['view', '-b', '-f', '4', 'input.bam', '-o', 'unmapped.bam']);
            expect(mockCLI.exec).toHaveBeenCalledWith('samtools', ['view', '-c', 'unmapped.bam']);
        });

        it('should handle BAM with no unmapped reads', async () => {
            mockCLI.exec.mockResolvedValue('');
            mockCLI.fs.stat.mockResolvedValue({ size: 0 });

            const result = await extractUnmappedReads(mockCLI, 'input.bam', 'unmapped.bam');

            expect(result.isEmpty).toBe(true);
            expect(result.size).toBe(0);
            expect(result.count).toBe(0);
        });

        it('should throw error if samtools fails', async () => {
            mockCLI.exec.mockRejectedValue(new Error('samtools error'));

            await expect(
                extractUnmappedReads(mockCLI, 'input.bam', 'unmapped.bam')
            ).rejects.toThrow('Failed to extract unmapped reads');
        });

        it('should throw error if output file not created', async () => {
            mockCLI.exec.mockResolvedValue('');
            mockCLI.fs.stat.mockRejectedValue(new Error('File not found'));

            await expect(
                extractUnmappedReads(mockCLI, 'input.bam', 'unmapped.bam')
            ).rejects.toThrow('Output file unmapped.bam was not created');
        });

        it('should handle count command failure gracefully', async () => {
            // First call succeeds (extraction), second call fails (count)
            mockCLI.exec.mockResolvedValueOnce('');
            mockCLI.exec.mockRejectedValueOnce(new Error('count failed'));

            mockCLI.fs.stat.mockResolvedValue({
                size: 1024 * 1024
            });

            const result = await extractUnmappedReads(mockCLI, 'input.bam', 'unmapped.bam');

            // Should still succeed, just with unknown count
            expect(result.isEmpty).toBe(false);
            expect(result.count).toBe('unknown');
        });
    });

    describe('mergeBamFiles', () => {
        it('should successfully merge BAM files', async () => {
            mockCLI.exec.mockResolvedValue('');
            mockCLI.fs.stat.mockResolvedValue({
                size: 1024 * 1024 * 10 // 10 MB
            });

            const result = await mergeBamFiles(
                mockCLI,
                ['region.bam', 'unmapped.bam'],
                'merged.bam'
            );

            expect(result).toMatchObject({
                path: 'merged.bam',
                size: 1024 * 1024 * 10
            });

            expect(mockCLI.exec).toHaveBeenCalledWith(
                'samtools',
                ['merge', '-f', 'merged.bam', 'region.bam', 'unmapped.bam']
            );
        });

        it('should throw error if less than 2 input files', async () => {
            await expect(
                mergeBamFiles(mockCLI, ['only-one.bam'], 'merged.bam')
            ).rejects.toThrow('requires at least 2 input files');
        });

        it('should throw error if no input files', async () => {
            await expect(
                mergeBamFiles(mockCLI, [], 'merged.bam')
            ).rejects.toThrow('requires at least 2 input files');
        });

        it('should throw error if input is null', async () => {
            await expect(
                mergeBamFiles(mockCLI, null, 'merged.bam')
            ).rejects.toThrow('requires at least 2 input files');
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

        it('should throw error if merged file not created', async () => {
            mockCLI.exec.mockResolvedValue('');
            mockCLI.fs.stat.mockRejectedValue(new Error('File not found'));

            await expect(
                mergeBamFiles(mockCLI, ['file1.bam', 'file2.bam'], 'merged.bam')
            ).rejects.toThrow('Merged file merged.bam was not created');
        });

        it('should handle merging multiple files', async () => {
            mockCLI.exec.mockResolvedValue('');
            mockCLI.fs.stat.mockResolvedValue({
                size: 1024 * 1024 * 20
            });

            const result = await mergeBamFiles(
                mockCLI,
                ['file1.bam', 'file2.bam', 'file3.bam'],
                'merged.bam'
            );

            expect(result.size).toBe(1024 * 1024 * 20);
            expect(mockCLI.exec).toHaveBeenCalledWith(
                'samtools',
                ['merge', '-f', 'merged.bam', 'file1.bam', 'file2.bam', 'file3.bam']
            );
        });
    });

    describe('validateBamFile', () => {
        it('should return true for valid BAM file', async () => {
            mockCLI.fs.stat.mockResolvedValue({ size: 1024 });

            const result = await validateBamFile(mockCLI, 'valid.bam');

            expect(result).toBe(true);
            expect(mockCLI.fs.stat).toHaveBeenCalledWith('valid.bam');
        });

        it('should return false for empty BAM file', async () => {
            mockCLI.fs.stat.mockResolvedValue({ size: 0 });

            const result = await validateBamFile(mockCLI, 'empty.bam');

            expect(result).toBe(false);
        });

        it('should return false if file does not exist', async () => {
            mockCLI.fs.stat.mockRejectedValue(new Error('ENOENT'));

            const result = await validateBamFile(mockCLI, 'missing.bam');

            expect(result).toBe(false);
        });

        it('should return false if stat returns null', async () => {
            mockCLI.fs.stat.mockResolvedValue(null);

            const result = await validateBamFile(mockCLI, 'null.bam');

            expect(result).toBe(false);
        });

        it('should return false if stat returns undefined', async () => {
            mockCLI.fs.stat.mockResolvedValue(undefined);

            const result = await validateBamFile(mockCLI, 'undefined.bam');

            expect(result).toBe(false);
        });
    });

    describe('extractUnmappedReads - performance tracking', () => {
        it('should track elapsed time', async () => {
            mockCLI.exec.mockResolvedValueOnce('');
            mockCLI.exec.mockResolvedValueOnce('1000\n');
            mockCLI.fs.stat.mockResolvedValue({ size: 1024 });

            const result = await extractUnmappedReads(mockCLI, 'input.bam', 'unmapped.bam');

            expect(result.elapsedTime).toBeDefined();
            expect(typeof result.elapsedTime).toBe('string');
            expect(parseFloat(result.elapsedTime)).toBeGreaterThanOrEqual(0);
        });
    });

    describe('mergeBamFiles - performance tracking', () => {
        it('should track elapsed time', async () => {
            mockCLI.exec.mockResolvedValue('');
            mockCLI.fs.stat.mockResolvedValue({ size: 1024 });

            const result = await mergeBamFiles(mockCLI, ['file1.bam', 'file2.bam'], 'merged.bam');

            expect(result.elapsedTime).toBeDefined();
            expect(typeof result.elapsedTime).toBe('string');
            expect(parseFloat(result.elapsedTime)).toBeGreaterThanOrEqual(0);
        });
    });

    describe('extractUnmappedReads - size formatting', () => {
        it('should format size correctly for MB', async () => {
            mockCLI.exec.mockResolvedValue('');
            mockCLI.fs.stat.mockResolvedValue({ size: 5242880 }); // 5 MB

            const result = await extractUnmappedReads(mockCLI, 'input.bam', 'unmapped.bam');

            expect(result.sizeFormatted).toBe('5.00 MB');
        });

        it('should format size correctly for KB', async () => {
            mockCLI.exec.mockResolvedValue('');
            mockCLI.fs.stat.mockResolvedValue({ size: 1024 }); // 1 KB

            const result = await extractUnmappedReads(mockCLI, 'input.bam', 'unmapped.bam');

            expect(result.sizeFormatted).toBe('0.00 MB');
        });
    });
});
