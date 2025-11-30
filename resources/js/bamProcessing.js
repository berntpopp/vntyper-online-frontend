// frontend/resources/js/bamProcessing.js

// Import the logging and UI message functions
import { logMessage } from './log.js';
import { displayMessage, createSpinnerHTML, ensureSpinAnimation } from './uiUtils.js';

// Import assemblies and NCBI accession helper
import { assemblies } from './assemblyConfigs.js';

// Import regions
import { regions } from './regionsConfig.js';

// ADDED: Import unmapped reads extraction utilities
import { extractUnmappedReads, mergeBamFiles } from './unmappedExtraction.js';

/**
 * Initializes Aioli with Samtools.
 * @returns {Promise<Aioli>} - The initialized Aioli CLI object.
 */
export async function initializeAioli() {
  try {
    logMessage('Initializing Aioli with Samtools...', 'info');
    const CLI = await new Aioli(['samtools/1.17']);
    logMessage('Aioli initialized successfully.', 'success');
    logMessage('CLI object:', 'info');
    logMessage(`CLI.fs is ${CLI.fs ? 'initialized' : 'undefined'}.`, 'info');

    if (!CLI.fs) {
      throw new Error('Failed to initialize the virtual filesystem (CLI.fs is undefined).');
    }

    return CLI;
  } catch (err) {
    logMessage(`Error initializing Aioli: ${err.message}`, 'error');
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
      errorDiv.textContent = 'Failed to initialize the processing environment.';
      errorDiv.classList.remove('hidden');
    }
    throw err;
  }
}

/**
 * Extracts the BAM header using samtools view -H.
 * @param {Aioli} CLI - The initialized Aioli CLI object.
 * @param {string} bamPath - The path to the BAM file in the virtual filesystem.
 * @returns {Promise<string>} - The BAM header as a string.
 */
async function extractBamHeader(CLI, bamPath) {
  const viewArgs = ['view', '-H', bamPath];
  logMessage(`Executing Samtools View Command to extract header: ${viewArgs.join(' ')}`, 'info');

  try {
    const result = await CLI.exec('samtools', viewArgs);
    const header = result;
    logMessage(`Extracted BAM Header for ${bamPath}:\n${header}`, 'info');

    return header;
  } catch (err) {
    logMessage(`Error extracting BAM header for ${bamPath}: ${err.message}`, 'error');
    throw err;
  }
}

/**
 * Parses the BAM header to extract contig information and potential reference assembly indicators.
 * @param {string} header - The BAM header as a string.
 * @returns {Object} - An object containing contigs and assembly hints.
 */
function parseHeader(header) {
  const contigs = [];
  const assemblyHints = [];
  const lines = header.split('\n');

  lines.forEach(line => {
    if (line.startsWith('@SQ')) {
      // Parse contig lines
      const tokens = line.split('\t');
      const contig = {};
      tokens.forEach(token => {
        const [key, value] = token.split(':');
        if (key === 'SN') {
          contig.name = value;
        } else if (key === 'LN') {
          contig.length = parseInt(value, 10);
        }
      });
      if (contig.name && contig.length) {
        contigs.push(contig);
      }
    } else if (line.startsWith('@PG')) {
      // Parse program group lines for assembly hints
      const clMatch = line.match(/CL:([^\t]*)/);
      const dsMatch = line.match(/DS:([^\t]*)/);

      if (clMatch) {
        const clValue = clMatch[1];
        assemblyHints.push(clValue);
      }

      if (dsMatch) {
        const dsValue = dsMatch[1];
        assemblyHints.push(dsValue);
      }
    }
  });

  logMessage('Parsed Contigs:', 'info');
  logMessage(JSON.stringify(contigs, null, 2), 'info');
  logMessage('Assembly Hints from @PG lines:', 'info');
  logMessage(JSON.stringify(assemblyHints, null, 2), 'info');
  return { contigs, assemblyHints };
}

/**
 * Detects the chromosome naming convention used in a BAM file.
 *
 * Analyzes contig names from @SQ header lines to determine which naming
 * convention is predominantly used.
 *
 * Conventions:
 * - UCSC: chr1, chr2, chrX, chrY, chrM (prefix with "chr")
 * - ENSEMBL: 1, 2, X, Y, MT (simple numeric/letter)
 * - NCBI: NC_000001.10, NC_000002.11 (RefSeq accessions)
 *
 * Requires at least 50% of contigs to match a pattern for confident detection.
 *
 * @param {Array<{name: string, length: number}>} contigs - Parsed @SQ contigs
 * @returns {"ucsc"|"ensembl"|"ncbi"|"unknown"} Detected naming convention
 *
 * @example
 * const contigs = [{name: "chr1", length: 248956422}, {name: "chr2", length: 242193529}];
 * detectNamingConvention(contigs); // Returns "ucsc"
 *
 * @example
 * const contigs = [{name: "NC_000001.11", length: 248956422}];
 * detectNamingConvention(contigs); // Returns "ncbi"
 */
export function detectNamingConvention(contigs) {
  if (!contigs || contigs.length === 0) {
    logMessage('No contigs provided for convention detection', 'warning');
    return 'unknown';
  }

  // Define regex patterns for each convention
  const patterns = {
    ucsc: /^chr[0-9XYM]+$/i, // chr1, chr2, chrX, chrY, chrM (case-insensitive)
    ensembl: /^([0-9]+|X|Y|MT?)$/i, // 1, 2, X, Y, MT or M (case-insensitive)
    ncbi: /^NC_\d{6}\.\d+$/, // NC_000001.10, NC_000001.11, etc.
  };

  // Define main chromosome patterns (more specific - for prioritized checking)
  const mainChromosomePatterns = {
    ucsc: /^chr([0-9]{1,2}|X|Y|M)$/i, // chr1-chr22, chrX, chrY, chrM
    ensembl: /^([0-9]{1,2}|X|Y|MT?)$/i, // 1-22, X, Y, MT or M
    ncbi: /^NC_00000[012]\.(10|11)$/, // NC_000001.10/11 through NC_000024.9/10
  };

  // First pass: Check ONLY main chromosomes (1-22, X, Y, M)
  // This avoids contamination from random/unplaced contigs
  const mainContigs = contigs.filter(c => {
    const name = c.name;
    return (
      mainChromosomePatterns.ucsc.test(name) ||
      mainChromosomePatterns.ensembl.test(name) ||
      mainChromosomePatterns.ncbi.test(name)
    );
  });

  // Count matches in main chromosomes
  const mainCounts = { ucsc: 0, ensembl: 0, ncbi: 0 };
  for (const contig of mainContigs) {
    const name = contig.name;
    if (mainChromosomePatterns.ucsc.test(name)) mainCounts.ucsc++;
    if (mainChromosomePatterns.ensembl.test(name)) mainCounts.ensembl++;
    if (mainChromosomePatterns.ncbi.test(name)) mainCounts.ncbi++;
  }

  // Count matches in ALL contigs (for logging)
  const allCounts = { ucsc: 0, ensembl: 0, ncbi: 0 };
  for (const contig of contigs) {
    const name = contig.name;
    if (patterns.ucsc.test(name)) allCounts.ucsc++;
    if (patterns.ensembl.test(name)) allCounts.ensembl++;
    if (patterns.ncbi.test(name)) allCounts.ncbi++;
  }

  const total = contigs.length;
  const mainTotal = mainContigs.length;
  const threshold = 0.5; // 50% of contigs must match

  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  logMessage('🔍 NAMING CONVENTION DETECTION', 'info');
  logMessage(`Total contigs: ${total}`, 'info');
  logMessage(`Main chromosomes: ${mainTotal}`, 'info');
  logMessage(
    `UCSC matches (all): ${allCounts.ucsc} (${Math.round((allCounts.ucsc / total) * 100)}%)`,
    'info'
  );
  logMessage(
    `UCSC matches (main): ${mainCounts.ucsc} (${mainTotal > 0 ? Math.round((mainCounts.ucsc / mainTotal) * 100) : 0}%)`,
    'info'
  );
  logMessage(
    `ENSEMBL matches (main): ${mainCounts.ensembl} (${mainTotal > 0 ? Math.round((mainCounts.ensembl / mainTotal) * 100) : 0}%)`,
    'info'
  );
  logMessage(
    `NCBI matches (main): ${mainCounts.ncbi} (${mainTotal > 0 ? Math.round((mainCounts.ncbi / mainTotal) * 100) : 0}%)`,
    'info'
  );

  // Decision logic: Prioritize main chromosomes if we have any
  // Priority: NCBI > UCSC > ENSEMBL (NCBI is most specific)
  if (mainTotal > 0) {
    // We have main chromosomes - use them for detection (more reliable)
    if (mainCounts.ncbi / mainTotal >= threshold) {
      logMessage(`✅ Detected NCBI naming convention (from main chromosomes)`, 'success');
      logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      return 'ncbi';
    }

    if (mainCounts.ucsc / mainTotal >= threshold) {
      logMessage(`✅ Detected UCSC naming convention (from main chromosomes)`, 'success');
      logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      return 'ucsc';
    }

    if (mainCounts.ensembl / mainTotal >= threshold) {
      logMessage(`✅ Detected ENSEMBL naming convention (from main chromosomes)`, 'success');
      logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      return 'ensembl';
    }
  }

  // Fallback: Check all contigs if main chromosomes didn't give clear answer
  if (allCounts.ncbi / total >= threshold) {
    logMessage(`✅ Detected NCBI naming convention (from all contigs)`, 'success');
    logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
    return 'ncbi';
  }

  if (allCounts.ucsc / total >= threshold) {
    logMessage(`✅ Detected UCSC naming convention (from all contigs)`, 'success');
    logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
    return 'ucsc';
  }

  if (allCounts.ensembl / total >= threshold) {
    logMessage(`✅ Detected ENSEMBL naming convention (from all contigs)`, 'success');
    logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
    return 'ensembl';
  }

  logMessage(
    '⚠️  Could not confidently detect naming convention (mixed or uncommon format)',
    'warning'
  );
  logMessage(
    `First 5 contigs: ${contigs
      .slice(0, 5)
      .map(c => c.name)
      .join(', ')}`,
    'warning'
  );
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

  return 'unknown';
}

/**
 * Maps assembly names to their coordinate systems.
 * Separates biological coordinates (GRCh37/GRCh38) from naming conventions.
 */
// ===============================================================
// PIPELINE DETECTION AND WARNING
// ===============================================================
/**
 * Detects the alignment pipeline from the BAM header and warns the user if it's potentially unsupported.
 * @param {string} header - The BAM header as a string.
 */
function detectPipelineAndWarn(header) {
  const lowerHeader = header.toLowerCase();
  let pipeline = 'Unknown';
  let warningMessage = '';

  if (lowerHeader.includes('dragen')) {
    pipeline = 'Dragen';
    warningMessage =
      '⚠️  Pipeline Warning: The Dragen pipeline has known issues aligning reads in the MUC1 VNTR region. For best results, consider using the offline VNtyper CLI in normal mode.';
  } else if (lowerHeader.includes('clc') || lowerHeader.includes('clcbio')) {
    pipeline = 'CLC';
    warningMessage =
      '⚠️  Pipeline Warning: The CLC pipeline has not been fully tested and may have issues aligning reads in the MUC1 VNTR region. Please verify results carefully or use the offline VNtyper CLI.';
  } else if (lowerHeader.includes('bwa')) {
    pipeline = 'BWA';
  }

  if (warningMessage) {
    logMessage(`Detected pipeline: ${pipeline}. Displaying warning.`, 'warning');
    displayMessage(warningMessage, 'warning'); // Use a new 'warning' message type
  } else {
    logMessage(`Detected pipeline: ${pipeline}. No warnings needed.`, 'info');
  }
}
// ===============================================================

/**
 * Extracts potential assembly names from assembly hints using context-aware scoring.
 * @param {string[]} assemblyHints - Array of strings extracted from @PG lines.
 * @returns {string|null} - Detected assembly name or null if not found.
 */
function extractAssemblyFromHints(assemblyHints) {
  // Known assembly identifiers and their possible representations
  const assemblyIdentifiers = {
    hg19: ['hg19'],
    hg38: ['hg38'],
    GRCh37: ['GRCh37', 'hs37d5', 'hs37'],
    GRCh38: ['GRCh38', 'hs38DH', 'hs38'],
  };

  // Context patterns with their weights
  // POSITIVE contexts (indicate this assembly IS being used)
  const positiveContexts = [
    { pattern: /--ref(?:erence)?[-=\s:]/i, weight: 10, name: '--reference' },
    { pattern: /--ref-dir[-=\s:]/i, weight: 10, name: '--ref-dir' },
    { pattern: /--ht-reference[-=\s:]/i, weight: 10, name: '--ht-reference' },
    { pattern: /--build-hash-table.*--ht-reference/i, weight: 10, name: 'hash table reference' },
    { pattern: /--output-directory\s+(\S+)/i, weight: 8, name: '--output-directory' },
    { pattern: /\.fa(?:sta)?[\s"']/i, weight: 5, name: 'reference file' },
    { pattern: /\/reference\//i, weight: 5, name: 'reference path' },
  ];

  // NEGATIVE contexts (indicate this assembly is being EXCLUDED/SKIPPED)
  const negativeContexts = [
    { pattern: /--skip[-_]?(?:vc-on-)?contigs?[-=\s:]/i, weight: -10, name: '--skip contigs' },
    { pattern: /--exclude[-_]?contigs?[-=\s:]/i, weight: -10, name: '--exclude contigs' },
    { pattern: /--decoy[-_]?contigs?[-=\s:]/i, weight: -8, name: '--decoy contigs' },
    { pattern: /vc-decoy-contigs?[-=\s:]/i, weight: -8, name: 'variant caller decoys' },
    { pattern: /--ignore[-=\s:]/i, weight: -10, name: '--ignore' },
  ];

  // Track all matches with their scores
  const matchesFound = [];

  for (const [assembly, identifiers] of Object.entries(assemblyIdentifiers)) {
    for (const id of identifiers) {
      const lowerCaseId = id.toLowerCase();
      const regex = new RegExp(`\\b${lowerCaseId}\\b`, 'i');

      // Find all contexts where this identifier appears
      assemblyHints.forEach(hint => {
        if (regex.test(hint)) {
          // Find the position of the match
          const matchResult = hint.match(regex);
          if (!matchResult) return;

          const matchIndex = matchResult.index;
          const contextBefore = hint.substring(Math.max(0, matchIndex - 100), matchIndex);
          const contextAfter = hint.substring(matchIndex, Math.min(hint.length, matchIndex + 100));
          const fullContext = contextBefore + contextAfter;

          // Calculate score based on context
          let score = 1; // Base score for finding the identifier
          const matchedContexts = [];

          // Check positive contexts
          for (const ctx of positiveContexts) {
            if (ctx.pattern.test(contextBefore)) {
              score += ctx.weight;
              matchedContexts.push({ type: 'positive', name: ctx.name, weight: ctx.weight });
            }
          }

          // Check negative contexts
          for (const ctx of negativeContexts) {
            if (ctx.pattern.test(contextBefore)) {
              score += ctx.weight; // Note: weight is negative
              matchedContexts.push({ type: 'negative', name: ctx.name, weight: ctx.weight });
            }
          }

          matchesFound.push({
            assembly,
            identifier: id,
            context: fullContext,
            contextBefore,
            score,
            matchedContexts,
            priority: identifiers.indexOf(id),
          });
        }
      });
    }
  }

  // Filter out negative-scored matches
  const positiveMatches = matchesFound.filter(m => m.score > 0);

  if (positiveMatches.length === 0 && matchesFound.length > 0) {
    logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'warning');
    logMessage(
      '⚠️  WARNING: Found assembly identifiers, but all in negative contexts (skip/exclude)',
      'warning'
    );
    matchesFound.forEach(match => {
      logMessage(
        `  • ${match.assembly} '${match.identifier}' in: ${match.matchedContexts.map(c => c.name).join(', ')}`,
        'warning'
      );
    });
    logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'warning');
    return null;
  }

  if (positiveMatches.length === 0) {
    logMessage('No assembly detected from @PG lines.', 'info');
    return null;
  }

  // Log all positive matches with their scores
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  logMessage(`Found ${positiveMatches.length} assembly identifier(s) in @PG lines:`, 'info');
  positiveMatches.forEach(match => {
    const contextType =
      match.matchedContexts.length > 0
        ? match.matchedContexts
            .map(c => `${c.type}: ${c.name} (${c.weight > 0 ? '+' : ''}${c.weight})`)
            .join(', ')
        : 'neutral context';
    logMessage(
      `  • ${match.assembly} (matched '${match.identifier}') - Score: ${match.score}`,
      match.score > 5 ? 'info' : 'debug'
    );
    logMessage(`    Context: ${contextType}`, 'debug');
    logMessage(`    Text: "...${match.context.substring(0, 80)}..."`, 'debug');
  });

  // Sort by score (highest first), then by assembly preference, then by priority
  const assemblyOrder = ['GRCh38', 'GRCh37', 'hg38', 'hg19'];
  positiveMatches.sort((a, b) => {
    // First, sort by score (higher is better)
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Then by assembly preference
    const aOrder = assemblyOrder.indexOf(a.assembly);
    const bOrder = assemblyOrder.indexOf(b.assembly);
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    // Finally by identifier priority (more specific first)
    return a.priority - b.priority;
  });

  const selectedMatch = positiveMatches[0];

  // Check for conflicts with significantly different scores
  const assemblyCandidates = {};
  positiveMatches.forEach(match => {
    if (
      !assemblyCandidates[match.assembly] ||
      assemblyCandidates[match.assembly].score < match.score
    ) {
      assemblyCandidates[match.assembly] = match;
    }
  });

  const uniqueAssemblies = Object.keys(assemblyCandidates);

  if (uniqueAssemblies.length > 1) {
    logMessage(`⚠️  Multiple assemblies detected:`, 'warning');
    uniqueAssemblies.forEach(asm => {
      const match = assemblyCandidates[asm];
      logMessage(`    ${asm}: score=${match.score}, identifier='${match.identifier}'`, 'warning');
    });
    logMessage(
      `    Selecting ${selectedMatch.assembly} (highest score: ${selectedMatch.score})`,
      'warning'
    );
    logMessage(`    If incorrect, please select assembly manually from dropdown.`, 'warning');
  }

  logMessage(
    `🎯 Selected assembly: ${selectedMatch.assembly} (score: ${selectedMatch.score}, based on '${selectedMatch.identifier}')`,
    'success'
  );
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

  return selectedMatch.assembly;
}

/**
 * Detects the reference genome assembly using multi-method validation.
 * ALWAYS checks ALL methods (@ PG context, chr1 length, full contig comparison)
 * and cross-validates results before making final decision.
 *
 * @param {Object[]} bamContigs - Contigs extracted from the BAM header.
 * @param {string[]} assemblyHints - Assembly hints extracted from @PG lines.
 * @returns {string|null} - The detected assembly name or null if uncertain.
 */
function detectAssembly(bamContigs, assemblyHints) {
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  logMessage('🔍 MULTI-METHOD ASSEMBLY DETECTION', 'info');
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

  // ==================================================================
  // METHOD 1: @PG Context Analysis (with positive/negative scoring)
  // ==================================================================
  logMessage('📋 Method 1: Analyzing @PG header lines with context scoring...', 'info');
  const detectedFromPG = extractAssemblyFromHints(assemblyHints);

  // ==================================================================
  // METHOD 2: Chromosome Length Analysis (most reliable!)
  // ==================================================================
  logMessage('', 'info');
  logMessage('📏 Method 2: Analyzing chr1 length (most reliable marker)...', 'info');

  const chr1Lengths = {
    GRCh37: 249250621,
    hg19: 249250621,
    GRCh38: 248956422,
    hg38: 248956422,
  };

  let detectedFromChr1 = null;
  const chr1 = bamContigs.find(c => c.name === 'chr1' || c.name === '1');

  if (chr1) {
    const chr1Length = chr1.length;
    logMessage(`  Found chr1: ${chr1Length.toLocaleString()} bp`, 'info');

    for (const [assembly, length] of Object.entries(chr1Lengths)) {
      if (chr1Length === length) {
        detectedFromChr1 = assembly;
        logMessage(`  ✅ chr1 Length Match: ${assembly}`, 'success');
        break;
      }
    }

    if (!detectedFromChr1) {
      logMessage(`  ⚠️  Unknown chr1 length: ${chr1Length.toLocaleString()} bp`, 'warning');
      logMessage(`  Known lengths:`, 'info');
      Object.entries(chr1Lengths).forEach(([asm, len]) => {
        logMessage(`    ${asm}: ${len.toLocaleString()} bp`, 'info');
      });
    }
  } else {
    logMessage(`  ⚠️  chr1 not found (may use numeric names like '1')`, 'warning');
  }

  // ==================================================================
  // METHOD 3: Full Contig Comparison (fallback)
  // ==================================================================
  logMessage('', 'info');
  logMessage('📊 Method 3: Full contig comparison analysis...', 'info');

  const threshold = 0.9;
  let detectedFromContigs = null;
  let bestMatch = { assembly: null, percentage: 0 };

  for (const assemblyKey in assemblies) {
    const assembly = assemblies[assemblyKey];
    const matchCount = bamContigs.reduce((count, bamContig) => {
      const assemblyContig = assembly.contigs.find(
        aContig => aContig.name === bamContig.name && aContig.length === bamContig.length
      );
      return assemblyContig ? count + 1 : count;
    }, 0);

    const matchPercentage = matchCount / assembly.contigs.length;
    logMessage(
      `  ${assembly.name}: ${Math.round(matchPercentage * 100)}% match`,
      matchPercentage >= threshold ? 'info' : 'debug'
    );

    if (matchPercentage > bestMatch.percentage) {
      bestMatch = { assembly: assembly.name, percentage: matchPercentage };
    }

    if (matchPercentage >= threshold && !detectedFromContigs) {
      detectedFromContigs = assembly.name;
    }
  }

  if (detectedFromContigs) {
    logMessage(
      `  ✅ Contig Comparison Result: ${detectedFromContigs} (${Math.round(bestMatch.percentage * 100)}%)`,
      'success'
    );
  } else if (bestMatch.assembly) {
    logMessage(
      `  ⚠️  Best match: ${bestMatch.assembly} (${Math.round(bestMatch.percentage * 100)}% - below ${threshold * 100}% threshold)`,
      'warning'
    );
  } else {
    logMessage(`  ⚠️  Contig Comparison Result: No confident match`, 'warning');
  }

  // ==================================================================
  // CROSS-VALIDATION: Compare ALL methods and decide
  // ==================================================================
  logMessage('', 'info');
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  logMessage('🔬 CROSS-VALIDATION & DECISION', 'info');
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

  logMessage('Method Results:', 'info');
  logMessage(
    `  @PG Context:       ${detectedFromPG || 'Not detected'}`,
    detectedFromPG ? 'info' : 'warning'
  );
  logMessage(
    `  chr1 Length:       ${detectedFromChr1 || 'Not detected'}`,
    detectedFromChr1 ? 'info' : 'warning'
  );
  logMessage(
    `  Contig Comparison: ${detectedFromContigs || 'Not detected'}`,
    detectedFromContigs ? 'info' : 'warning'
  );
  logMessage('', 'info');

  // Normalize assembly names (GRCh38 == hg38, GRCh37 == hg19)
  const normalize = asm => {
    if (!asm) return null;
    if (asm === 'hg38' || asm === 'GRCh38') return 'GRCh38';
    if (asm === 'hg19' || asm === 'GRCh37') return 'GRCh37';
    return asm;
  };

  const normalizedPG = normalize(detectedFromPG);
  const normalizedChr1 = normalize(detectedFromChr1);
  const normalizedContigs = normalize(detectedFromContigs);

  // DEBUG: Log normalized values for troubleshooting
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  logMessage('🔍 NORMALIZATION DEBUG', 'info');
  logMessage(`Original values:`, 'info');
  logMessage(`  @PG: ${detectedFromPG} → Normalized: ${normalizedPG}`, 'info');
  logMessage(`  chr1: ${detectedFromChr1} → Normalized: ${normalizedChr1}`, 'info');
  logMessage(`  Contigs: ${detectedFromContigs} → Normalized: ${normalizedContigs}`, 'info');
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

  let finalAssembly = null;
  let confidence = 'LOW';
  let reasoning = '';

  // DECISION LOGIC (Priority Order based on reliability)
  //  1. All three agree → VERY HIGH confidence
  //  2. chr1 + contigs agree → HIGH confidence (chr1 is most reliable)
  //  3. chr1 + @PG agree → MEDIUM-HIGH confidence
  //  4. Only chr1 → MEDIUM confidence (chr1 is reliable)
  //  5. Only @PG → LOW-MEDIUM confidence (needs validation)
  //  6. Only contigs → LOW confidence
  //  7. Nothing → FAIL

  if (
    normalizedPG &&
    normalizedChr1 &&
    normalizedContigs &&
    normalizedPG === normalizedChr1 &&
    normalizedChr1 === normalizedContigs
  ) {
    // Case 1: ALL THREE AGREE
    // Use contig result to preserve correct naming convention (hg38 vs GRCh38)
    finalAssembly = detectedFromContigs;
    confidence = 'VERY HIGH';
    reasoning = 'All three methods agree';
    logMessage(`✅ CONSENSUS: All methods agree on ${normalizedPG} coordinate system`, 'success');
    logMessage(`   Using contig comparison result: ${finalAssembly}`, 'info');
  } else if (normalizedChr1 && normalizedContigs && normalizedChr1 === normalizedContigs) {
    // Case 2: chr1 + contigs agree (HIGH CONFIDENCE)
    // Use contig result to preserve correct naming convention (hg38 vs GRCh38)
    finalAssembly = detectedFromContigs;
    confidence = 'HIGH';
    reasoning = 'chr1 length and contig comparison agree';
    if (normalizedPG && normalizedPG !== normalizedChr1) {
      logMessage(
        `⚠️  CONFLICT RESOLVED: @PG says ${normalizedPG}, but chr1 + contigs both say ${normalizedChr1}`,
        'warning'
      );
      logMessage(`   Trusting chromosome data (more reliable than @PG lines)`, 'warning');
      logMessage(`   Using contig comparison result: ${finalAssembly}`, 'info');
    } else {
      logMessage(`✅ STRONG MATCH: chr1 length and contigs agree on ${normalizedChr1}`, 'success');
      logMessage(`   Using contig comparison result: ${finalAssembly}`, 'info');
    }
  } else if (normalizedChr1 && normalizedPG && normalizedChr1 === normalizedPG) {
    // Case 3: chr1 + @PG agree
    finalAssembly = normalizedChr1;
    confidence = 'MEDIUM-HIGH';
    reasoning = 'chr1 length and @PG context agree';
    logMessage(`✅ GOOD MATCH: chr1 and @PG agree on ${finalAssembly}`, 'success');
    if (normalizedContigs && normalizedContigs !== normalizedChr1) {
      logMessage(
        `   Note: Contig comparison suggested ${normalizedContigs} (may have custom contigs)`,
        'info'
      );
    }
  } else if (normalizedChr1) {
    // Case 4: Only chr1 detected
    finalAssembly = normalizedChr1;
    confidence = 'MEDIUM';
    reasoning = 'Based on chr1 length only';
    logMessage(`⚠️  Using chr1 length as primary evidence: ${finalAssembly}`, 'warning');
    logMessage(`   chr1 is reliable, but other methods could not confirm`, 'warning');
  } else if (normalizedPG) {
    // Case 5: Only @PG detected
    finalAssembly = normalizedPG;
    confidence = 'LOW-MEDIUM';
    reasoning = 'Based on @PG context only (NOT validated by chr1 length)';
    logMessage(`⚠️  WARNING: Using @PG context only: ${finalAssembly}`, 'warning');
    logMessage(`   Could not validate against chromosome lengths!`, 'warning');
    logMessage(`   Please verify this is correct manually!`, 'warning');
  } else if (normalizedContigs) {
    // Case 6: Only contigs detected
    finalAssembly = normalizedContigs;
    confidence = 'LOW';
    reasoning = 'Based on contig comparison only';
    logMessage(`⚠️  WARNING: Using contig comparison only: ${finalAssembly}`, 'warning');
    logMessage(`   Could not validate with @PG or chr1 length`, 'warning');
  } else {
    // Case 7: NOTHING detected
    logMessage(`❌ DETECTION FAILED: Could not detect assembly with any method`, 'error');
    logMessage(`   Please select assembly manually from dropdown`, 'error');
    logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
    return null;
  }

  // ==================================================================
  // MAP TO CORRECT ASSEMBLY BASED ON BAM NAMING CONVENTION
  // ==================================================================
  // We now have a coordinate system (GRCh37 or GRCh38)
  // But we need to return the correct assembly name based on the BAM's naming convention
  const detectedConvention = detectNamingConvention(bamContigs);
  logMessage('', 'info');
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  logMessage('🔤 NAMING CONVENTION MAPPING', 'info');
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  logMessage(`Detected coordinate system: ${finalAssembly}`, 'info');
  logMessage(`Detected naming convention: ${detectedConvention}`, 'info');

  // Map coordinate system + naming convention to assembly name
  let mappedAssembly = finalAssembly;
  if (finalAssembly === 'GRCh38') {
    if (detectedConvention === 'ucsc') {
      mappedAssembly = 'hg38';
      logMessage(`✅ Mapping GRCh38 + UCSC → hg38`, 'success');
    } else if (detectedConvention === 'ncbi') {
      mappedAssembly = 'hg38_ncbi';
      logMessage(`✅ Mapping GRCh38 + NCBI → hg38_ncbi`, 'success');
    } else {
      // ENSEMBL or unknown - keep GRCh38
      logMessage(`✅ Keeping GRCh38 (ENSEMBL numeric convention)`, 'success');
    }
  } else if (finalAssembly === 'GRCh37') {
    if (detectedConvention === 'ucsc') {
      mappedAssembly = 'hg19';
      logMessage(`✅ Mapping GRCh37 + UCSC → hg19`, 'success');
    } else if (detectedConvention === 'ncbi') {
      mappedAssembly = 'hg19_ncbi';
      logMessage(`✅ Mapping GRCh37 + NCBI → hg19_ncbi`, 'success');
    } else {
      // ENSEMBL or unknown - keep GRCh37
      logMessage(`✅ Keeping GRCh37 (ENSEMBL numeric convention)`, 'success');
    }
  }

  finalAssembly = mappedAssembly;
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

  // ==================================================================
  // FINAL SUMMARY
  // ==================================================================
  logMessage('', 'info');
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  logMessage('🎯 FINAL DECISION', 'info');
  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  logMessage(`Assembly:   ${finalAssembly}`, 'success');
  logMessage(
    `Confidence: ${confidence}`,
    confidence.includes('HIGH') ? 'success' : confidence.includes('MEDIUM') ? 'info' : 'warning'
  );
  logMessage(`Reasoning:  ${reasoning}`, 'info');

  if (confidence === 'LOW' || confidence === 'LOW-MEDIUM') {
    logMessage('', 'warning');
    logMessage('⚠️  LOW CONFIDENCE DETECTION', 'warning');
    logMessage(
      '   Recommendation: Verify assembly is correct or select manually from dropdown',
      'warning'
    );
  }

  logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

  return finalAssembly;
}

/**
 * Determines the assembly and genomic region to extract based on user selection or auto-detection.
 * Consolidates logic shared between SAM and BAM processing branches (DRY principle).
 *
 * @param {Array} bamContigs - Array of contig objects from BAM header
 * @param {Object} assemblyHints - Assembly hints from @PG header parsing
 * @param {string} regionValue - User-selected region value from dropdown ('guess' or assembly name)
 * @returns {Object} - Object containing {assembly: string, region: string}
 * @throws {Error} - If no region is configured for the detected/selected assembly
 */
function determineAssemblyAndRegion(bamContigs, assemblyHints, regionValue) {
  let detectedAssembly = null;

  // Determine assembly (either auto-detect or use user selection)
  if (regionValue === 'guess') {
    detectedAssembly = detectAssembly(bamContigs, assemblyHints);
    logMessage(`Auto-detected assembly: ${detectedAssembly || 'None'}`, 'info');
  } else {
    detectedAssembly = regionValue;
    logMessage(`User-selected assembly (skipping auto-detection): ${detectedAssembly}`, 'info');
  }

  // Use detected or selected assembly for region lookup
  const assemblyForRegion = detectedAssembly || regionValue;

  // Look up region configuration using assembly name
  const regionInfo = regions[assemblyForRegion];

  if (!regionInfo) {
    throw new Error(
      `No region configured for assembly: ${assemblyForRegion}. Available options: ${Object.keys(regions).join(', ')}`
    );
  }

  // Extract region string (already has correct chromosome naming from regionsConfig)
  const region = regionInfo.region;
  logMessage(`Region to extract: ${region}`, 'info');

  return {
    assembly: detectedAssembly,
    region,
  };
}

/**
 * Extracts the specified region from a BAM file using Samtools.
 * @param {Aioli} CLI - The initialized Aioli CLI object.
 * @param {string} bamPath - The path to the BAM file in the virtual filesystem.
 * @param {string} region - The genomic region to extract.
 * @param {string} subsetBamName - The desired name for the subset BAM file.
 * @returns {Promise<string>} - The path to the subset BAM file.
 */
async function extractRegion(CLI, bamPath, region, subsetBamName) {
  const subsetBamPath = subsetBamName;
  const viewCommand = 'samtools';
  const viewArgs = ['view', '-P', '-b', bamPath, region, '-o', subsetBamPath];
  logMessage(`Executing Samtools View Command: ${viewCommand} ${viewArgs.join(' ')}`, 'info');

  try {
    const viewResult = await CLI.exec(viewCommand, viewArgs);
    logMessage(`Samtools View Output for ${subsetBamPath}: ${viewResult}`, 'info');

    // Verify subset BAM creation
    const subsetBamStats = await CLI.fs.stat(subsetBamPath);
    logMessage(`${subsetBamPath} Stats: ${JSON.stringify(subsetBamStats)}`, 'info');

    if (!subsetBamStats || subsetBamStats.size === 0) {
      throw new Error(
        `Subset BAM file ${subsetBamPath} was not created or is empty. No reads found in the specified region.`
      );
    }

    return subsetBamPath;
  } catch (err) {
    logMessage(`Error extracting region from BAM file ${bamPath}: ${err.message}`, 'error');
    throw err;
  }
}

/**
 * Indexes a BAM file using Samtools.
 * @param {Aioli} CLI - The initialized Aioli CLI object.
 * @param {string} subsetBamPath - The path to the subset BAM file.
 * @returns {Promise<void>}
 */
async function indexBam(CLI, subsetBamPath) {
  logMessage(`Indexing subset BAM: ${subsetBamPath}`, 'info');
  const indexCommand = 'samtools';
  const indexArgs = ['index', subsetBamPath];
  try {
    const indexResult = await CLI.exec(indexCommand, indexArgs);
    logMessage(`Samtools Index Output for ${subsetBamPath}: ${indexResult}`, 'info');

    // Verify BAI creation
    const subsetBaiPath = `${subsetBamPath}.bai`;
    const subsetBaiStats = await CLI.fs.stat(subsetBaiPath);
    logMessage(`${subsetBaiPath} Stats: ${JSON.stringify(subsetBaiStats)}`, 'info');

    if (!subsetBaiStats || subsetBaiStats.size === 0) {
      throw new Error(`Index BAI file ${subsetBamPath}.bai was not created or is empty.`);
    }

    logMessage(`Successfully indexed BAM file: ${subsetBamPath}`, 'success');
  } catch (err) {
    logMessage(`Error indexing BAM file ${subsetBamPath}: ${err.message}`, 'error');
    throw err;
  }
}

/**
 * Processes a single BAM/BAI pair or a SAM file: extracts the specified region, indexes the subset BAM,
 * and respects the user's assembly choice if not set to "guess".
 *
 * For SAM files, the pipeline mounts the SAM file, converts it to BAM (using "samtools view -bS"),
 * sorts the resulting BAM file, indexes it, and then uses the header to auto-detect the assembly
 * and region before returning the corresponding Blob objects.
 *
 * @param {Aioli} CLI - The initialized Aioli CLI object.
 * @param {Object} pair - A single matched file pair. The object should have either:
 *                          - a "bam" and (optionally) "bai" property, or
 *                          - a "sam" property.
 * @returns {Promise<Object>} - An object containing subset BAM/BAI Blobs and detected assembly & region.
 */
export async function extractRegionAndIndex(CLI, pair) {
  const regionSelect = document.getElementById('region');
  const regionValue = regionSelect.value;

  // ADDED: Read normal mode checkbox
  const normalModeCheckbox = document.getElementById('normalMode');
  const normalMode = normalModeCheckbox ? normalModeCheckbox.checked : false;

  logMessage('Extract Region and Index Function Triggered', 'info');
  logMessage(`Selected Region from dropdown: ${regionValue}`, 'info');
  logMessage(
    `🔬 Normal Mode: ${normalMode ? 'ENABLED (will extract unmapped reads)' : 'DISABLED (fast mode)'}`,
    normalMode ? 'info' : 'debug'
  );

  // Input Validation
  if (!regionValue) {
    logMessage('No region selected.', 'error');
    throw new Error('No region selected.');
  }

  // Ensure spin animation CSS is loaded
  ensureSpinAnimation();

  // Update UI to indicate processing with spinner (DRY)
  const extractBtn = document.getElementById('extractBtn');
  extractBtn.disabled = true;
  extractBtn.innerHTML = createSpinnerHTML({
    size: 16,
    text: 'Processing...',
  });
  logMessage("Extract button disabled and text updated to 'Processing...'", 'info');

  let detectedAssembly = null;
  let region = null;
  const subsetBamAndBaiBlobs = [];

  try {
    if (pair.sam) {
      // Process SAM file conversion branch
      logMessage('SAM file detected. Starting SAM to BAM conversion pipeline...', 'info');
      // Mount the SAM file
      const paths = await CLI.mount([pair.sam]);
      logMessage(`Mounted Paths: ${paths.join(', ')}`, 'info');
      const samPath = paths.find(p => p.endsWith(pair.sam.name));
      if (!samPath) {
        throw new Error(`Failed to mount SAM file: ${pair.sam.name}`);
      }
      logMessage(`Processing SAM file: ${samPath}`, 'info');
      // Define output filenames
      const convertedBamName = `converted_${pair.sam.name.replace(/\.sam$/i, '.bam')}`;
      const sortedBamName = `sorted_${convertedBamName}`;

      // Convert SAM to BAM
      const convertArgs = ['view', '-bS', samPath, '-o', convertedBamName];
      logMessage(
        `Executing Samtools View Command to convert SAM to BAM: ${convertArgs.join(' ')}`,
        'info'
      );
      const convertResult = await CLI.exec('samtools', convertArgs);
      logMessage(`Samtools View Output for conversion: ${convertResult}`, 'info');

      // Sort the converted BAM file
      const sortArgs = ['sort', convertedBamName, '-o', sortedBamName];
      logMessage(`Executing Samtools Sort Command: ${sortArgs.join(' ')}`, 'info');
      const sortResult = await CLI.exec('samtools', sortArgs);
      logMessage(`Samtools Sort Output for ${sortedBamName}: ${sortResult}`, 'info');

      // Index the sorted BAM file
      const indexArgs = ['index', sortedBamName];
      logMessage(`Executing Samtools Index Command: ${indexArgs.join(' ')}`, 'info');
      const indexResult = await CLI.exec('samtools', indexArgs);
      logMessage(`Samtools Index Output for ${sortedBamName}: ${indexResult}`, 'info');

      // Verify sorted BAM and index creation
      const sortedBamStats = await CLI.fs.stat(sortedBamName);
      logMessage(`${sortedBamName} Stats: ${JSON.stringify(sortedBamStats)}`, 'info');
      if (!sortedBamStats || sortedBamStats.size === 0) {
        throw new Error(`Sorted BAM file ${sortedBamName} was not created or is empty.`);
      }
      const sortedBaiPath = `${sortedBamName}.bai`;
      const sortedBaiStats = await CLI.fs.stat(sortedBaiPath);
      logMessage(`${sortedBaiPath} Stats: ${JSON.stringify(sortedBaiStats)}`, 'info');
      if (!sortedBaiStats || sortedBaiStats.size === 0) {
        throw new Error(`Index BAI file ${sortedBaiPath} was not created or is empty.`);
      } // Extract and parse header from the sorted BAM file
      const header = await extractBamHeader(CLI, sortedBamName);

      // ===============================================================
      // MODIFICATION: Call the new pipeline detection function here.
      // ===============================================================
      detectPipelineAndWarn(header);

      const { contigs: bamContigs, assemblyHints } = parseHeader(header);

      // Determine assembly and region using unified helper function (DRY)
      const assemblyAndRegion = determineAssemblyAndRegion(bamContigs, assemblyHints, regionValue);
      detectedAssembly = assemblyAndRegion.assembly;
      region = assemblyAndRegion.region;

      // For SAM branch, directly prepare the blobs from the sorted BAM and its index.
      const sortedBamData = await CLI.fs.readFile(sortedBamName);
      const sortedBamBlob = new Blob([sortedBamData], { type: 'application/octet-stream' });
      if (sortedBamBlob.size === 0) {
        logMessage(`Failed to create Blob from sorted BAM file ${sortedBamName}.`, 'error');
        throw new Error(`Failed to create Blob from sorted BAM file ${sortedBamName}.`);
      }
      logMessage(`Created Blob for sorted BAM: ${sortedBamName}`, 'info');

      const sortedBaiData = await CLI.fs.readFile(sortedBaiPath);
      const sortedBaiBlob = new Blob([sortedBaiData], { type: 'application/octet-stream' });
      if (sortedBaiBlob.size === 0) {
        logMessage(`Failed to create Blob from index file ${sortedBaiPath}.`, 'error');
        throw new Error(`Failed to create Blob from index file ${sortedBaiPath}.`);
      }
      logMessage(`Created Blob for sorted BAI: ${sortedBaiPath}`, 'info');

      subsetBamAndBaiBlobs.push({
        subsetBamBlob: sortedBamBlob,
        subsetBaiBlob: sortedBaiBlob,
        subsetName: sortedBamName,
      });

      logMessage(
        `SAM file conversion, sorting, and indexing completed successfully for ${pair.sam.name}.`,
        'success'
      );

      return {
        subsetBamAndBaiBlobs,
        detectedAssembly,
        region,
      };
    } else if (pair.bam) {
      // Existing processing for BAM and BAI pairs
      logMessage('Mounting BAM and BAI files...', 'info');
      const paths = await CLI.mount([pair.bam, pair.bai]);
      logMessage(`Mounted Paths: ${paths.join(', ')}`, 'info');

      const bamPath = paths.find(p => p.endsWith(pair.bam.name));
      logMessage(`Processing BAM: ${bamPath}`, 'info'); // Extract and parse BAM Header
      const header = await extractBamHeader(CLI, bamPath);

      // ===============================================================
      // MODIFICATION: Call the new pipeline detection function here.
      // ===============================================================
      detectPipelineAndWarn(header);

      const { contigs: bamContigs, assemblyHints } = parseHeader(header);

      // Determine assembly and region using unified helper function (DRY)
      const assemblyAndRegion = determineAssemblyAndRegion(bamContigs, assemblyHints, regionValue);
      detectedAssembly = assemblyAndRegion.assembly;
      region = assemblyAndRegion.region;

      // Extract Region
      const subsetBamName = `subset_${pair.bam.name}`;
      await extractRegion(CLI, bamPath, region, subsetBamName);

      // Variable to hold the final BAM path (either subset or merged)
      let finalBamPath = subsetBamName;
      let processingMode = 'fast';

      // ============================================================
      // NORMAL MODE: Extract and merge unmapped reads
      // ============================================================
      if (normalMode) {
        logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
        logMessage('🔬 NORMAL MODE ACTIVATED', 'info');
        logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
        logMessage('This will extract unmapped reads and merge with the region subset.', 'info');
        logMessage('Expected time: 2-3x longer than fast mode.', 'info');
        logMessage('', 'info');

        const unmappedBamName = `unmapped_${pair.bam.name}`;

        try {
          // Step 1: Extract unmapped reads using BGZF offset seeking (FAST!)
          logMessage('📋 Step 1/3: Extracting unmapped reads (BGZF offset seeking)...', 'info');

          // ADDED: Check subset BAM before extraction
          const subsetStats = await CLI.fs.stat(subsetBamName);
          logMessage(
            `✓ Region subset BAM exists: ${subsetBamName} (${(subsetStats.size / 1024 / 1024).toFixed(2)} MB)`,
            'info'
          );

          const unmappedResult = await extractUnmappedReads(
            CLI,
            pair.bam,
            pair.bai,
            unmappedBamName
          );

          // Check if we have any unmapped reads
          if (unmappedResult.isEmpty || unmappedResult.size === 0) {
            logMessage('⚠️ No unmapped reads found in this BAM file.', 'warning');
            logMessage('Continuing with region subset only (equivalent to fast mode).', 'warning');
            processingMode = 'normal-no-unmapped';
            // Continue with finalBamPath = subsetBamName
          } else {
            logMessage(
              `✅ Found ${unmappedResult.count} unmapped reads (${unmappedResult.sizeFormatted})`,
              'success'
            );

            // ADDED: Verify unmapped BAM was written to virtual FS
            try {
              const unmappedStats = await CLI.fs.stat(unmappedBamName);
              logMessage(
                `✓ Unmapped BAM exists in virtual FS: ${unmappedBamName} (${(unmappedStats.size / 1024 / 1024).toFixed(2)} MB)`,
                'info'
              );
            } catch (e) {
              throw new Error(
                `Unmapped BAM file ${unmappedBamName} not found in virtual FS: ${e.message}`
              );
            }

            // Step 2: Merge region subset + unmapped reads
            logMessage('📋 Step 2/3: Merging region subset + unmapped reads...', 'info');
            logMessage(
              `  Input 1: ${subsetBamName} (${(subsetStats.size / 1024 / 1024).toFixed(2)} MB)`,
              'info'
            );
            logMessage(`  Input 2: ${unmappedBamName} (${unmappedResult.sizeFormatted})`, 'info');

            const mergedBamName = `merged_${pair.bam.name}`;

            const mergeResult = await mergeBamFiles(
              CLI,
              [subsetBamName, unmappedBamName],
              mergedBamName
            );

            logMessage(`✅ Merge complete: ${mergeResult.sizeFormatted}`, 'success');

            // NOTE: Don't check file size - merged is compressed while inputs are uncompressed
            // So merged will be SMALLER than sum of inputs due to BGZF compression

            // ADDED: Count reads in each file for verification
            logMessage('Verifying read counts...', 'info');
            try {
              const subsetCount = await CLI.exec('samtools', ['view', '-c', subsetBamName]);
              const unmappedCount = await CLI.exec('samtools', ['view', '-c', unmappedBamName]);
              const mergedCount = await CLI.exec('samtools', ['view', '-c', mergedBamName]);

              logMessage(`  Region reads: ${subsetCount.trim()}`, 'info');
              logMessage(`  Unmapped reads: ${unmappedCount.trim()}`, 'info');
              logMessage(`  Merged total: ${mergedCount.trim()}`, 'info');

              const expectedTotal = parseInt(subsetCount.trim()) + parseInt(unmappedCount.trim());
              const actualTotal = parseInt(mergedCount.trim());

              if (actualTotal < expectedTotal * 0.9) {
                logMessage(`⚠️ WARNING: Merged file missing reads!`, 'error');
                logMessage(`  Expected: ${expectedTotal} reads`, 'error');
                logMessage(`  Got: ${actualTotal} reads`, 'error');
                logMessage(`  Missing: ${expectedTotal - actualTotal} reads`, 'error');
              } else {
                logMessage(`✓ Read count verification passed`, 'success');
              }
            } catch (countError) {
              logMessage(`Could not verify read counts: ${countError.message}`, 'warning');
            }

            // Use merged BAM as final output
            finalBamPath = mergedBamName;
            processingMode = 'normal-merged';

            logMessage('', 'info');
            logMessage('📊 NORMAL MODE SUMMARY:', 'success');
            logMessage(
              `  • Region BAM: ${subsetBamName} (${(subsetStats.size / 1024 / 1024).toFixed(2)} MB)`,
              'info'
            );
            logMessage(
              `  • Unmapped BAM: ${unmappedResult.count} reads (${unmappedResult.sizeFormatted})`,
              'info'
            );
            logMessage(`  • Merged BAM: ${mergedBamName} (${mergeResult.sizeFormatted})`, 'info');
            logMessage('', 'info');
          }
        } catch (error) {
          // Non-fatal error: log warning and continue with region subset only
          logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'warning');
          logMessage(`⚠️ WARNING: Normal mode processing failed: ${error.message}`, 'warning');
          logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'warning');
          logMessage('Falling back to fast mode (region subset only).', 'warning');
          logMessage('Your analysis will continue but without unmapped reads.', 'warning');
          logMessage('', 'warning');

          processingMode = 'normal-failed';
          // Continue with finalBamPath = subsetBamName
        }

        logMessage('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      }
      // ============================================================
      // END NORMAL MODE
      // ============================================================

      // Index Final BAM (works for both fast mode and normal mode)
      logMessage(`📋 ${normalMode ? 'Step 3/3' : 'Step 2/2'}: Indexing final BAM...`, 'info');
      await indexBam(CLI, finalBamPath);

      // Create Blob for final BAM
      const finalBam = await CLI.fs.readFile(finalBamPath);
      const finalBamBlob = new Blob([finalBam], { type: 'application/octet-stream' });
      if (finalBamBlob.size === 0) {
        logMessage(`Failed to create Blob from BAM file ${finalBamPath}.`, 'error');
        throw new Error(`Failed to create Blob from BAM file ${finalBamPath}.`);
      }
      const finalBamSizeMB = (finalBamBlob.size / 1024 / 1024).toFixed(2);
      logMessage(`Created Blob for final BAM: ${finalBamPath} (${finalBamSizeMB} MB)`, 'info');

      // Create Blob for final BAI
      const finalBaiPath = `${finalBamPath}.bai`;
      const finalBai = await CLI.fs.readFile(finalBaiPath);
      const finalBaiBlob = new Blob([finalBai], { type: 'application/octet-stream' });
      if (finalBaiBlob.size === 0) {
        logMessage(`Failed to create Blob from BAI file ${finalBaiPath}.`, 'error');
        throw new Error(`Failed to create Blob from BAI file ${finalBaiPath}.`);
      }
      const finalBaiSizeKB = (finalBaiBlob.size / 1024).toFixed(2);
      logMessage(`Created Blob for final BAI: ${finalBaiPath} (${finalBaiSizeKB} KB)`, 'info');

      subsetBamAndBaiBlobs.push({
        subsetBamBlob: finalBamBlob,
        subsetBaiBlob: finalBaiBlob,
        subsetName: finalBamPath,
        processingMode, // ADDED: Track which mode was used
      });

      // Final success message
      const modeDescription = normalMode
        ? processingMode === 'normal-merged'
          ? '(Region + Unmapped)'
          : '(Region only - no unmapped found)'
        : '(Fast mode)';

      logMessage(`✅ Processing complete for ${pair.bam.name} ${modeDescription}`, 'success');
      logMessage('', 'info');

      return {
        subsetBamAndBaiBlobs,
        detectedAssembly,
        region,
        processingMode, // ADDED: Return mode info for debugging
      };
    }
  } catch (err) {
    logMessage(`Error during extraction and indexing: ${err.message}`, 'error');
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
      errorDiv.textContent = `Error: ${err.message}`;
      errorDiv.classList.remove('hidden');
    }
    throw err;
  } finally {
    // Reset the button
    extractBtn.disabled = false;
    extractBtn.textContent = 'Extract Region';
    logMessage("Extract button re-enabled and text reset to 'Extract Region'.", 'info');
  }
}
