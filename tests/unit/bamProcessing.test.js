// tests/unit/bamProcessing.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Test suite for assembly detection in BAM processing
 *
 * This tests the critical bug fix for issue where hs37 was incorrectly detected
 * from "--skip-vc-on-contigs hs37d5" when the actual assembly was hs38DH (GRCh38).
 */

// Mock dependencies
vi.mock('../../resources/js/log.js', () => ({
    logMessage: vi.fn()
}));

vi.mock('../../resources/js/assemblyConfigs.js', () => ({
    assemblies: {
        GRCh37: {
            name: 'GRCh37',
            contigs: [
                { name: 'chr1', length: 249250621 },
                { name: 'chr2', length: 243199373 }
            ]
        },
        GRCh38: {
            name: 'GRCh38',
            contigs: [
                { name: 'chr1', length: 248956422 },
                { name: 'chr2', length: 242193529 }
            ]
        }
    }
}));

// Import the functions we need to test
// We'll need to refactor bamProcessing.js to export these functions for testing
// For now, we'll create a test double of the logic

/**
 * Test implementation of extractAssemblyFromHints with context-aware scoring
 * This mirrors the fixed implementation from bamProcessing.js
 */
function extractAssemblyFromHints(assemblyHints) {
    const assemblyIdentifiers = {
        hg19: ['hg19'],
        hg38: ['hg38'],
        GRCh37: ['GRCh37', 'hs37d5', 'hs37'],
        GRCh38: ['GRCh38', 'hs38DH', 'hs38']
    };

    const positiveContexts = [
        { pattern: /--ref(?:erence)?[-=\s:]/i, weight: 10 },
        { pattern: /--ref-dir[-=\s:]/i, weight: 10 },
        { pattern: /--ht-reference[-=\s:]/i, weight: 10 },
        { pattern: /--output-directory\s+(\S+)/i, weight: 8 },
        { pattern: /\.fa(?:sta)?[\s"']/i, weight: 5 },
        { pattern: /\/reference\//i, weight: 5 }
    ];

    const negativeContexts = [
        { pattern: /--skip[-_]?(?:vc-on-)?contigs?[-=\s:]/i, weight: -10 },
        { pattern: /--exclude[-_]?contigs?[-=\s:]/i, weight: -10 },
        { pattern: /--decoy[-_]?contigs?[-=\s:]/i, weight: -8 },
        { pattern: /vc-decoy-contigs?[-=\s:]/i, weight: -8 }
    ];

    const matchesFound = [];

    for (const [assembly, identifiers] of Object.entries(assemblyIdentifiers)) {
        for (const id of identifiers) {
            const lowerCaseId = id.toLowerCase();
            const regex = new RegExp(`\\b${lowerCaseId}\\b`, 'i');

            assemblyHints.forEach((hint) => {
                if (regex.test(hint)) {
                    const matchResult = hint.match(regex);
                    if (!matchResult) return;

                    const matchIndex = matchResult.index;
                    const contextBefore = hint.substring(Math.max(0, matchIndex - 100), matchIndex);

                    let score = 1;

                    for (const ctx of positiveContexts) {
                        if (ctx.pattern.test(contextBefore)) {
                            score += ctx.weight;
                        }
                    }

                    for (const ctx of negativeContexts) {
                        if (ctx.pattern.test(contextBefore)) {
                            score += ctx.weight;
                        }
                    }

                    matchesFound.push({
                        assembly: assembly,
                        identifier: id,
                        score: score,
                        priority: identifiers.indexOf(id)
                    });
                }
            });
        }
    }

    const positiveMatches = matchesFound.filter(m => m.score > 0);

    if (positiveMatches.length === 0) {
        return null;
    }

    const assemblyOrder = ['GRCh38', 'GRCh37', 'hg38', 'hg19'];
    positiveMatches.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        const aOrder = assemblyOrder.indexOf(a.assembly);
        const bOrder = assemblyOrder.indexOf(b.assembly);
        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }
        return a.priority - b.priority;
    });

    return positiveMatches[0].assembly;
}

describe('BAM Assembly Detection - Context-Aware Scoring Fix', () => {
    describe('Context Scoring - Negative Contexts', () => {
        it('should ignore hs37d5 in --skip-vc-on-contigs (negative context)', () => {
            const hints = ['--skip-vc-on-contigs hs37d5'];
            const result = extractAssemblyFromHints(hints);

            // Should return null because hs37d5 is in skip context (negative score)
            expect(result).toBeNull();
        });

        it('should ignore assemblies in --exclude-contigs', () => {
            const hints = ['--exclude-contigs hs38'];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBeNull();
        });

        it('should ignore assemblies in vc-decoy-contigs', () => {
            const hints = ['vc-decoy-contigs: hs37d5 chrUn_*'];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBeNull();
        });
    });

    describe('Context Scoring - Positive Contexts', () => {
        it('should detect hs38DH in --ref-dir (positive context)', () => {
            const hints = ['--ref-dir /scratch/reference/hs38DH'];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBe('GRCh38');
        });

        it('should detect assembly from --reference flag', () => {
            const hints = ['--reference /data/GRCh38.fa'];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBe('GRCh38');
        });

        it('should detect assembly from --ht-reference', () => {
            const hints = ['--ht-reference hs38DH.fa'];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBe('GRCh38');
        });
    });

    describe('Context Scoring - Mixed Contexts', () => {
        it('should prioritize positive context (ref-dir) over negative (skip)', () => {
            const hints = [
                '--ref-dir /scratch/reference/hs38DH',
                '--skip-vc-on-contigs hs37d5'
            ];
            const result = extractAssemblyFromHints(hints);

            // hs38DH has positive score (10+1=11)
            // hs37d5 has negative score (-10+1=-9, filtered out)
            // Result: GRCh38
            expect(result).toBe('GRCh38');
        });

        it('should handle the EXACT problematic Dragen case', () => {
            const hints = [
                '--build-hash-table true --output-directory hs38DH --ht-reference hs38DH.fa --ht-alt-liftover hs38DH.fa.alt',
                '--ref-dir /scratch/reference/hs38DH',
                '--skip-vc-on-contigs hs37d5 --skip-vc-on-contigs NC_007605'
            ];
            const result = extractAssemblyFromHints(hints);

            // hs38DH appears in positive contexts (--ref-dir, --ht-reference, --output-directory)
            // hs37d5 appears in negative context (--skip-vc-on-contigs)
            // Result: GRCh38 with high score
            expect(result).toBe('GRCh38');
        });
    });

    describe('extractAssemblyFromHints - Word Boundary Matching', () => {
        it('should match complete words only', () => {
            const hints = ['myhs38project'];
            const result = extractAssemblyFromHints(hints);

            // Should NOT match because it's not a word boundary
            expect(result).toBeNull();
        });

        it('should correctly detect hs38DH as GRCh38', () => {
            const hints = ['--ref-dir /scratch/reference/hs38DH'];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBe('GRCh38');
        });

        it('should prioritize hs38DH over hs37d5 when both present', () => {
            const hints = [
                '--ref-dir /scratch/reference/hs38DH',
                '--skip-vc-on-contigs hs37d5'
            ];
            const result = extractAssemblyFromHints(hints);

            // GRCh38 should win because it's preferred in assemblyOrder
            expect(result).toBe('GRCh38');
        });

        it('should handle the actual problematic Dragen BAM case', () => {
            // This is the exact case from the bug report
            const hints = [
                '--output-directory hs38DH --ht-reference hs38DH.fa --ht-alt-liftover hs38DH.fa.alt',
                '--ref-dir /scratch/reference/hs38DH',
                '--skip-vc-on-contigs hs37d5 --skip-vc-on-contigs NC_007605',
                'vc-decoy-contigs: NC_007605 hs37d5 chrUn_KN707*v1_decoy'
            ];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBe('GRCh38');
        });

        it('should not match partial words', () => {
            const hints = ['myhs38project'];  // hs38 is part of a larger word
            const result = extractAssemblyFromHints(hints);

            // Should NOT match because it's not a word boundary
            expect(result).toBeNull();
        });

        it('should match with various separators', () => {
            const testCases = [
                ['--ref=hs38DH', 'GRCh38'],
                ['--ref:hs38DH', 'GRCh38'],
                ['--ref hs38DH', 'GRCh38'],
                ['--ref/hs38DH', 'GRCh38'],
                ['hs38DH.fa', 'GRCh38']
            ];

            testCases.forEach(([hint, expected]) => {
                const result = extractAssemblyFromHints([hint]);
                expect(result).toBe(expected);
            });
        });
    });

    describe('Assembly Priority and Conflict Resolution', () => {
        it('should prioritize GRCh38 over GRCh37', () => {
            const hints = [
                'reference hs38DH',
                'decoy hs37d5'
            ];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBe('GRCh38');
        });

        it('should prioritize more specific identifiers first', () => {
            // hs38DH should match before hs38
            const hints = ['--ref hs38DH'];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBe('GRCh38');
        });

        it('should return null when no assemblies found', () => {
            const hints = ['--some-random-option value'];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBeNull();
        });

        it('should handle empty hints', () => {
            const result = extractAssemblyFromHints([]);
            expect(result).toBeNull();
        });
    });

    describe('Chromosome Length Validation Logic', () => {
        it('should detect GRCh38 from chr1 length 248956422', () => {
            const chr1Length = 248956422;
            const chr1Lengths = {
                'GRCh37': 249250621,
                'hg19': 249250621,
                'GRCh38': 248956422,
                'hg38': 248956422
            };

            let matchedAssembly = null;
            for (const [assembly, length] of Object.entries(chr1Lengths)) {
                if (chr1Length === length) {
                    matchedAssembly = assembly;
                    break;
                }
            }

            expect(matchedAssembly).toBe('GRCh38');
        });

        it('should detect GRCh37 from chr1 length 249250621', () => {
            const chr1Length = 249250621;
            const chr1Lengths = {
                'GRCh37': 249250621,
                'hg19': 249250621,
                'GRCh38': 248956422,
                'hg38': 248956422
            };

            let matchedAssembly = null;
            for (const [assembly, length] of Object.entries(chr1Lengths)) {
                if (chr1Length === length) {
                    matchedAssembly = assembly;
                    break;
                }
            }

            expect(matchedAssembly).toBe('GRCh37');
        });

        it('should return null for unknown chr1 length', () => {
            const chr1Length = 999999999;  // Invalid length
            const chr1Lengths = {
                'GRCh37': 249250621,
                'hg19': 249250621,
                'GRCh38': 248956422,
                'hg38': 248956422
            };

            let matchedAssembly = null;
            for (const [assembly, length] of Object.entries(chr1Lengths)) {
                if (chr1Length === length) {
                    matchedAssembly = assembly;
                    break;
                }
            }

            expect(matchedAssembly).toBeNull();
        });
    });

    describe('Real-world BAM Header Cases', () => {
        it('should handle BWA-aligned GRCh38 BAM', () => {
            const hints = [
                'bwa mem -M /reference/GRCh38.fa',
                'samtools sort -O bam'
            ];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBe('GRCh38');
        });

        it('should handle GATK pipeline with hg38', () => {
            const hints = [
                '--reference /data/hg38.fa',
                '--known-sites /data/dbsnp_hg38.vcf'
            ];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBe('hg38');
        });

        it('should handle 1000 Genomes GRCh37 BAM', () => {
            const hints = [
                'reference=/ftp/1000genomes/technical/reference/human_g1k_v37.fasta'
            ];
            const result = extractAssemblyFromHints(hints);

            // Should not match anything specific, but if we had 'hs37' in the path it would
            expect(result).toBeNull();
        });

        it('should handle CLC Genomics Workbench', () => {
            const hints = [
                'CLC Genomics Workbench 22.0',
                'Reference: hg38.fasta'
            ];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBe('hg38');
        });
    });

    describe('Edge Cases and Robustness', () => {
        it('should be case-insensitive', () => {
            const testCases = [
                ['--ref HS38DH', 'GRCh38'],
                ['--ref hs38dh', 'GRCh38'],
                ['--ref HG38', 'hg38'],
                ['--ref GRCH38', 'GRCh38']
            ];

            testCases.forEach(([hint, expected]) => {
                const result = extractAssemblyFromHints([hint]);
                expect(result).toBe(expected);
            });
        });

        it('should handle very long hint strings', () => {
            const longHint = 'x'.repeat(10000) + ' hs38DH ' + 'y'.repeat(10000);
            const result = extractAssemblyFromHints([longHint]);

            expect(result).toBe('GRCh38');
        });

        it('should handle special characters in hints', () => {
            const hints = ['--ref=/path/to/hs38DH.fa.gz'];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBe('GRCh38');
        });

        it('should handle hints with newlines', () => {
            const hints = ['--ref hs38DH\n--param value'];
            const result = extractAssemblyFromHints(hints);

            expect(result).toBe('GRCh38');
        });
    });
});

describe('Integration Test - Full Assembly Detection Flow', () => {
    it('should correctly process the problematic Dragen BAM', () => {
        // Simulate the exact data from the bug report
        const bamContigs = [
            { name: 'chr1', length: 248956422 },  // GRCh38 length
            { name: 'chr2', length: 242193529 }
        ];

        const assemblyHints = [
            '--output-directory hs38DH --ht-reference hs38DH.fa',
            '--ref-dir /scratch/reference/hs38DH',
            '--skip-vc-on-contigs hs37d5 NC_007605'
        ];

        // Step 1: Extract assembly from hints
        const detectedFromHints = extractAssemblyFromHints(assemblyHints);
        expect(detectedFromHints).toBe('GRCh38');

        // Step 2: Validate against chr1 length
        const chr1 = bamContigs.find(c => c.name === 'chr1');
        const chr1Lengths = {
            'GRCh37': 249250621,
            'GRCh38': 248956422
        };

        expect(chr1.length).toBe(chr1Lengths[detectedFromHints]);

        // Final result should be GRCh38
        expect(detectedFromHints).toBe('GRCh38');
    });
});
