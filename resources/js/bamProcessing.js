// frontend/resources/js/bamProcessing.js

// Import the logging and UI message functions
import { logMessage } from './log.js';
import { displayMessage } from './uiUtils.js'; // Import displayMessage

// Import assemblies
import { assemblies } from './assemblyConfigs.js';

// Import regions
import { regions } from './regionsConfig.js';

// ADDED: Import unmapped reads extraction utilities
import { extractUnmappedReads, mergeBamFiles, validateBamFile } from './unmappedExtraction.js';

/**
 * Initializes Aioli with Samtools.
 * @returns {Promise<Aioli>} - The initialized Aioli CLI object.
 */
export async function initializeAioli() {
    try {
        logMessage("Initializing Aioli with Samtools...", 'info');
        const CLI = await new Aioli(["samtools/1.17"]);
        logMessage("Aioli initialized successfully.", 'success');
        logMessage("CLI object:", 'info');
        logMessage(`CLI.fs is ${CLI.fs ? 'initialized' : 'undefined'}.`, 'info');

        if (!CLI.fs) {
            throw new Error("Failed to initialize the virtual filesystem (CLI.fs is undefined).");
        }

        return CLI;
    } catch (err) {
        logMessage(`Error initializing Aioli: ${err.message}`, 'error');
        const errorDiv = document.getElementById("error");
        if (errorDiv) {
            errorDiv.textContent = "Failed to initialize the processing environment.";
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
    const viewArgs = ["view", "-H", bamPath];
    logMessage(`Executing Samtools View Command to extract header: ${viewArgs.join(' ')}`, 'info');

    try {
        const result = await CLI.exec("samtools", viewArgs);
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

    lines.forEach((line) => {
        if (line.startsWith('@SQ')) {
            // Parse contig lines
            const tokens = line.split('\t');
            const contig = {};
            tokens.forEach((token) => {
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

    logMessage("Parsed Contigs:", 'info');
    logMessage(JSON.stringify(contigs, null, 2), 'info');
    logMessage("Assembly Hints from @PG lines:", 'info');
    logMessage(JSON.stringify(assemblyHints, null, 2), 'info');    return { contigs, assemblyHints };
}

// ===============================================================
// NEW FUNCTION TO DETECT PIPELINE AND WARN USER
// ===============================================================
/**
 * Detects the alignment pipeline from the BAM header and warns the user if it's potentially unsupported.
 * @param {string} header - The BAM header as a string.
 */
function detectPipelineAndWarn(header) {
    const lowerHeader = header.toLowerCase();
    let pipeline = "Unknown";
    let warningMessage = "";

    if (lowerHeader.includes("dragen")) {
        pipeline = "Dragen";
        warningMessage = "⚠️  Pipeline Warning: The Dragen pipeline has known issues aligning reads in the MUC1 VNTR region. For best results, consider using the offline VNtyper CLI in normal mode.";
    } else if (lowerHeader.includes("clc") || lowerHeader.includes("clcbio")) {
        pipeline = "CLC";
        warningMessage = "⚠️  Pipeline Warning: The CLC pipeline has not been fully tested and may have issues aligning reads in the MUC1 VNTR region. Please verify results carefully or use the offline VNtyper CLI.";
    } else if (lowerHeader.includes("bwa")) {
        pipeline = "BWA";
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
 * Extracts potential assembly names from assembly hints.
 * @param {string[]} assemblyHints - Array of strings extracted from @PG lines.
 * @returns {string|null} - Detected assembly name or null if not found.
 */
function extractAssemblyFromHints(assemblyHints) {
    // Known assembly identifiers and their possible representations
    const assemblyIdentifiers = {
        hg19: ['hg19'],
        hg38: ['hg38'],
        GRCh37: ['GRCh37', 'hs37'],
        GRCh38: ['GRCh38', 'hs38', 'hs38DH']
        // Add more assemblies and identifiers if needed
    };

    // Combine all hints into a single string for easier searching
    const hintsString = assemblyHints.join(' ').toLowerCase();

    for (const [assembly, identifiers] of Object.entries(assemblyIdentifiers)) {
        for (const id of identifiers) {
            if (hintsString.includes(id.toLowerCase())) {
                logMessage(`Assembly detected from @PG lines: ${assembly}`, 'info');
                return assembly;
            }
        }
    }

    logMessage('No assembly detected from @PG lines.', 'info');
    return null; // Return null if no assembly is found
}

/**
 * Detects the reference genome assembly by comparing contig lengths and assembly hints.
 * @param {Object[]} bamContigs - Contigs extracted from the BAM header.
 * @param {string[]} assemblyHints - Assembly hints extracted from @PG lines.
 * @returns {string|null} - The detected assembly name or null if uncertain.
 */
function detectAssembly(bamContigs, assemblyHints) {
    const threshold = 0.9; // At least 90% of contigs should match
    let detectedAssembly = extractAssemblyFromHints(assemblyHints);

    // If we found something from @PG lines, we can return early
    if (detectedAssembly) {
        return detectedAssembly;
    }

    // Otherwise, proceed with contig comparison
    for (const assemblyKey in assemblies) {
        const assembly = assemblies[assemblyKey];
        const matchCount = bamContigs.reduce((count, bamContig) => {
            const assemblyContig = assembly.contigs.find(
                (aContig) => aContig.name === bamContig.name && aContig.length === bamContig.length
            );
            return assemblyContig ? count + 1 : count;
        }, 0);

        const matchPercentage = matchCount / assembly.contigs.length;
        logMessage(`Assembly ${assembly.name} match: ${Math.round(matchPercentage * 100)}%`, 'info');

        if (matchPercentage >= threshold) {
            detectedAssembly = assembly.name;
            break;
        }
    }

    if (detectedAssembly) {
        logMessage(`Detected Assembly: ${detectedAssembly}`, 'success');
    } else {
        logMessage('Could not confidently detect the assembly based on contig comparison.', 'warning');
    }

    return detectedAssembly;
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
    const viewCommand = "samtools";
    const viewArgs = ["view", "-P", "-b", bamPath, region, "-o", subsetBamPath];
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
    const indexCommand = "samtools";
    const indexArgs = ["index", subsetBamPath];
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
    const regionSelect = document.getElementById("region");
    const regionValue = regionSelect.value;

    // ADDED: Read normal mode checkbox
    const normalModeCheckbox = document.getElementById('normalMode');
    const normalMode = normalModeCheckbox ? normalModeCheckbox.checked : false;

    logMessage("Extract Region and Index Function Triggered", 'info');
    logMessage(`Selected Region from dropdown: ${regionValue}`, 'info');
    logMessage(`🔬 Normal Mode: ${normalMode ? 'ENABLED (will extract unmapped reads)' : 'DISABLED (fast mode)'}`, normalMode ? 'info' : 'debug');

    // Input Validation
    if (!regionValue) {
        logMessage("No region selected.", 'error');
        throw new Error("No region selected.");
    }

    // Update UI to indicate processing
    const extractBtn = document.getElementById("extractBtn");
    extractBtn.disabled = true;
    extractBtn.textContent = "Processing...";
    logMessage("Extract button disabled and text updated to 'Processing...'", 'info');

    let detectedAssembly = null;
    let region = null;
    const subsetBamAndBaiBlobs = [];

    try {
        if (pair.sam) {
            // Process SAM file conversion branch
            logMessage("SAM file detected. Starting SAM to BAM conversion pipeline...", "info");
            // Mount the SAM file
            const paths = await CLI.mount([pair.sam]);
            logMessage(`Mounted Paths: ${paths.join(', ')}`, "info");
            const samPath = paths.find((p) => p.endsWith(pair.sam.name));
            if (!samPath) {
                throw new Error(`Failed to mount SAM file: ${pair.sam.name}`);
            }
            logMessage(`Processing SAM file: ${samPath}`, "info");
            // Define output filenames
            const convertedBamName = `converted_${pair.sam.name.replace(/\.sam$/i, ".bam")}`;
            const sortedBamName = `sorted_${convertedBamName}`;

            // Convert SAM to BAM
            const convertArgs = ["view", "-bS", samPath, "-o", convertedBamName];
            logMessage(`Executing Samtools View Command to convert SAM to BAM: ${convertArgs.join(' ')}`, "info");
            const convertResult = await CLI.exec("samtools", convertArgs);
            logMessage(`Samtools View Output for conversion: ${convertResult}`, "info");

            // Sort the converted BAM file
            const sortArgs = ["sort", convertedBamName, "-o", sortedBamName];
            logMessage(`Executing Samtools Sort Command: ${sortArgs.join(' ')}`, "info");
            const sortResult = await CLI.exec("samtools", sortArgs);
            logMessage(`Samtools Sort Output for ${sortedBamName}: ${sortResult}`, "info");

            // Index the sorted BAM file
            const indexArgs = ["index", sortedBamName];
            logMessage(`Executing Samtools Index Command: ${indexArgs.join(' ')}`, "info");
            const indexResult = await CLI.exec("samtools", indexArgs);
            logMessage(`Samtools Index Output for ${sortedBamName}: ${indexResult}`, "info");

            // Verify sorted BAM and index creation
            const sortedBamStats = await CLI.fs.stat(sortedBamName);
            logMessage(`${sortedBamName} Stats: ${JSON.stringify(sortedBamStats)}`, "info");
            if (!sortedBamStats || sortedBamStats.size === 0) {
                throw new Error(`Sorted BAM file ${sortedBamName} was not created or is empty.`);
            }
            const sortedBaiPath = `${sortedBamName}.bai`;
            const sortedBaiStats = await CLI.fs.stat(sortedBaiPath);
            logMessage(`${sortedBaiPath} Stats: ${JSON.stringify(sortedBaiStats)}`, "info");
            if (!sortedBaiStats || sortedBaiStats.size === 0) {
                throw new Error(`Index BAI file ${sortedBaiPath} was not created or is empty.`);
            }            // Extract and parse header from the sorted BAM file
            const header = await extractBamHeader(CLI, sortedBamName);
            
            // ===============================================================
            // MODIFICATION: Call the new pipeline detection function here.
            // ===============================================================
            detectPipelineAndWarn(header);
            
            const { contigs: bamContigs, assemblyHints } = parseHeader(header);

            // Determine assembly
            if (regionValue === 'guess') {
                detectedAssembly = detectAssembly(bamContigs, assemblyHints);
                logMessage(`Auto-detected assembly: ${detectedAssembly || 'None'}`, "info");            } else {
                detectedAssembly = regionValue;
                logMessage(`User-selected assembly (skipping auto-detection): ${detectedAssembly}`, "info");
            }

            // Determine Region
            const assemblyForRegion = detectedAssembly || regionValue;
            const regionInfo = regions[assemblyForRegion];

            if (regionInfo) {
                region = regionInfo.region;
            } else {
                if (assemblyForRegion === 'guess' || !assemblyForRegion) {
                     throw new Error('Could not determine region. Please select an assembly manually.');
                }
                throw new Error(`No region configured for assembly: ${assemblyForRegion}`);
            }
            logMessage(`Region to extract: ${region}`, "info");

            // For SAM branch, directly prepare the blobs from the sorted BAM and its index.
            const sortedBamData = await CLI.fs.readFile(sortedBamName);
            const sortedBamBlob = new Blob([sortedBamData], { type: 'application/octet-stream' });
            if (sortedBamBlob.size === 0) {
                logMessage(`Failed to create Blob from sorted BAM file ${sortedBamName}.`, "error");
                throw new Error(`Failed to create Blob from sorted BAM file ${sortedBamName}.`);
            }
            logMessage(`Created Blob for sorted BAM: ${sortedBamName}`, "info");

            const sortedBaiData = await CLI.fs.readFile(sortedBaiPath);
            const sortedBaiBlob = new Blob([sortedBaiData], { type: 'application/octet-stream' });
            if (sortedBaiBlob.size === 0) {
                logMessage(`Failed to create Blob from index file ${sortedBaiPath}.`, "error");
                throw new Error(`Failed to create Blob from index file ${sortedBaiPath}.`);
            }
            logMessage(`Created Blob for sorted BAI: ${sortedBaiPath}`, "info");

            subsetBamAndBaiBlobs.push({
                subsetBamBlob: sortedBamBlob,
                subsetBaiBlob: sortedBaiBlob,
                subsetName: sortedBamName
            });

            logMessage(`SAM file conversion, sorting, and indexing completed successfully for ${pair.sam.name}.`, "success");

            return {
                subsetBamAndBaiBlobs,
                detectedAssembly,
                region
            };
        } else if (pair.bam) {
            // Existing processing for BAM and BAI pairs
            logMessage("Mounting BAM and BAI files...", 'info');
            const paths = await CLI.mount([pair.bam, pair.bai]);
            logMessage(`Mounted Paths: ${paths.join(', ')}`, 'info');

            const bamPath = paths.find((p) => p.endsWith(pair.bam.name));
            logMessage(`Processing BAM: ${bamPath}`, 'info');            // Extract and parse BAM Header
            const header = await extractBamHeader(CLI, bamPath);
            
            // ===============================================================
            // MODIFICATION: Call the new pipeline detection function here.
            // ===============================================================
            detectPipelineAndWarn(header);
            
            const { contigs: bamContigs, assemblyHints } = parseHeader(header);

            // Determine assembly
            if (regionValue === 'guess') {
                detectedAssembly = detectAssembly(bamContigs, assemblyHints);
                logMessage(`Auto-detected assembly: ${detectedAssembly || 'None'}`, 'info');            } else {
                detectedAssembly = regionValue;
                logMessage(`User-selected assembly (skipping auto-detection): ${detectedAssembly}`, 'info');
            }

            // Determine Region
            const assemblyForRegion = detectedAssembly || regionValue;
            const regionInfo = regions[assemblyForRegion];

            if (regionInfo) {
                region = regionInfo.region;
            } else {
                if (assemblyForRegion === 'guess' || !assemblyForRegion) {
                     throw new Error('Could not determine region. Please select an assembly manually.');
                }
                throw new Error(`No region configured for assembly: ${assemblyForRegion}`);
            }

            logMessage(`Region to extract: ${region}`, 'info');

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
                    logMessage(`✓ Region subset BAM exists: ${subsetBamName} (${(subsetStats.size / 1024 / 1024).toFixed(2)} MB)`, 'info');

                    const unmappedResult = await extractUnmappedReads(CLI, pair.bam, pair.bai, unmappedBamName);

                    // Check if we have any unmapped reads
                    if (unmappedResult.isEmpty || unmappedResult.size === 0) {
                        logMessage('⚠️ No unmapped reads found in this BAM file.', 'warning');
                        logMessage('Continuing with region subset only (equivalent to fast mode).', 'warning');
                        processingMode = 'normal-no-unmapped';
                        // Continue with finalBamPath = subsetBamName
                    } else {
                        logMessage(`✅ Found ${unmappedResult.count} unmapped reads (${unmappedResult.sizeFormatted})`, 'success');

                        // ADDED: Verify unmapped BAM was written to virtual FS
                        try {
                            const unmappedStats = await CLI.fs.stat(unmappedBamName);
                            logMessage(`✓ Unmapped BAM exists in virtual FS: ${unmappedBamName} (${(unmappedStats.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
                        } catch (e) {
                            throw new Error(`Unmapped BAM file ${unmappedBamName} not found in virtual FS: ${e.message}`);
                        }

                        // Step 2: Merge region subset + unmapped reads
                        logMessage('📋 Step 2/3: Merging region subset + unmapped reads...', 'info');
                        logMessage(`  Input 1: ${subsetBamName} (${(subsetStats.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
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
                        logMessage(`  • Region BAM: ${subsetBamName} (${(subsetStats.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
                        logMessage(`  • Unmapped BAM: ${unmappedResult.count} reads (${unmappedResult.sizeFormatted})`, 'info');
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
                processingMode: processingMode  // ADDED: Track which mode was used
            });

            // Final success message
            const modeDescription = normalMode
                ? (processingMode === 'normal-merged' ? '(Region + Unmapped)' : '(Region only - no unmapped found)')
                : '(Fast mode)';

            logMessage(`✅ Processing complete for ${pair.bam.name} ${modeDescription}`, 'success');
            logMessage('', 'info');

            return {
                subsetBamAndBaiBlobs,
                detectedAssembly,
                region,
                processingMode  // ADDED: Return mode info for debugging
            };
        }
    } catch (err) {
        logMessage(`Error during extraction and indexing: ${err.message}`, 'error');
        const errorDiv = document.getElementById("error");
        if (errorDiv) {
            errorDiv.textContent = `Error: ${err.message}`;
            errorDiv.classList.remove('hidden');
        }
        throw err;
    } finally {
        // Reset the button
        extractBtn.disabled = false;
        extractBtn.textContent = "Extract Region";
        logMessage("Extract button re-enabled and text reset to 'Extract Region'.", 'info');
    }
}
