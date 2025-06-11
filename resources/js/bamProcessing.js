// frontend/resources/js/bamProcessing.js

// Import the logging function
import { logMessage } from './log.js';

// Import assemblies
import { assemblies } from './assemblyConfigs.js';

// Import regions
import { regions } from './regionsConfig.js';

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
    logMessage(JSON.stringify(assemblyHints, null, 2), 'info');

    return { contigs, assemblyHints };
}

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

    logMessage("Extract Region and Index Function Triggered", 'info');
    logMessage(`Selected Region from dropdown: ${regionValue}`, 'info');

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
            }

            // Extract and parse header from the sorted BAM file
            const header = await extractBamHeader(CLI, sortedBamName);
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
            logMessage(`Processing BAM: ${bamPath}`, 'info');

            // Extract and parse BAM Header
            const header = await extractBamHeader(CLI, bamPath);
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

            // Index Subset BAM
            await indexBam(CLI, subsetBamName);

            // Create Blob for subset BAM
            const subsetBam = await CLI.fs.readFile(subsetBamName);
            const subsetBamBlob = new Blob([subsetBam], { type: 'application/octet-stream' });
            if (subsetBamBlob.size === 0) {
                logMessage(`Failed to create Blob from subset BAM file ${subsetBamName}.`, 'error');
                throw new Error(`Failed to create Blob from subset BAM file ${subsetBamName}.`);
            }
            logMessage(`Created Blob for subset BAM: ${subsetBamName}`, 'info');

            // Create Blob for subset BAI
            const subsetBaiPath = `${subsetBamName}.bai`;
            const subsetBai = await CLI.fs.readFile(subsetBaiPath);
            const subsetBaiBlob = new Blob([subsetBai], { type: 'application/octet-stream' });
            if (subsetBaiBlob.size === 0) {
                logMessage(`Failed to create Blob from subset BAI file ${subsetBaiPath}.`, 'error');
                throw new Error(`Failed to create Blob from subset BAI file ${subsetBaiPath}.`);
            }
            logMessage(`Created Blob for subset BAI: ${subsetBaiPath}`, 'info');

            subsetBamAndBaiBlobs.push({
                subsetBamBlob,
                subsetBaiBlob,
                subsetName: subsetBamName
            });

            logMessage(`Subset BAM and BAI for ${pair.bam.name} created successfully.`, 'success');

            return {
                subsetBamAndBaiBlobs,
                detectedAssembly,
                region
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
