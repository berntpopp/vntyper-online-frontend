// frontend/ressources/js/bamProcessing.js

import { logMessage } from './log.js'; // Import the logMessage function

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
        hg19: ['hg19', 'hs37', 'GRCh37'],
        hg38: ['hg38', 'hs38', 'GRCh38', 'hs38DH']
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
    let detectedAssembly = null;

    // First, try to detect assembly from hints
    detectedAssembly = extractAssemblyFromHints(assemblyHints);
    if (detectedAssembly) {
        return detectedAssembly;
    }

    // If no assembly detected from hints, proceed with contig comparison
    for (const assemblyKey in assemblies) {
        const assembly = assemblies[assemblyKey];
        const matchCount = bamContigs.reduce((count, bamContig) => {
            const assemblyContig = assembly.contigs.find(aContig => aContig.name === bamContig.name);
            if (assemblyContig && assemblyContig.length === bamContig.length) {
                return count + 1;
            }
            return count;
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
            throw new Error(`Subset BAM file ${subsetBamPath} was not created or is empty. No reads found in the specified region.`);
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
            throw new Error(`Index BAI file ${subsetBaiPath} was not created or is empty.`);
        }

        logMessage(`Successfully indexed BAM file: ${subsetBamPath}`, 'success');
    } catch (err) {
        logMessage(`Error indexing BAM file ${subsetBamPath}: ${err.message}`, 'error');
        throw err;
    }
}

/**
 * Processes a single BAM and BAI pair: extracts the specified region, indexes the subset BAM, and detects the assembly.
 * @param {Aioli} CLI - The initialized Aioli CLI object.
 * @param {Object} pair - A single matched BAM and BAI file pair.
 * @returns {Promise<Object>} - An object containing subset BAM/BAI Blobs and detected assembly.
 */
export async function extractRegionAndIndex(CLI, pair) {
    const regionSelect = document.getElementById("region");
    const regionValue = regionSelect.value;

    logMessage("Extract Region and Index Function Triggered", 'info');
    logMessage(`Selected Region: ${regionValue}`, 'info');

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
        // Mount BAM and BAI files
        logMessage("Mounting BAM and BAI files...", 'info');
        const paths = await CLI.mount([pair.bam, pair.bai]);
        logMessage(`Mounted Paths: ${paths.join(', ')}`, 'info');

        const bamPath = paths.find(p => p.endsWith(pair.bam.name));
        const baiPath = paths.find(p => p.endsWith(pair.bai.name));

        logMessage(`Processing BAM: ${bamPath}, BAI: ${baiPath}`, 'info');

        // Extract and Parse BAM Header
        const header = await extractBamHeader(CLI, bamPath);
        const { contigs: bamContigs, assemblyHints } = parseHeader(header);

        // Detect Assembly
        if (!detectedAssembly) {
            detectedAssembly = detectAssembly(bamContigs, assemblyHints);
            logMessage(`Detected Assembly: ${detectedAssembly}`, 'info');
        }

        // Determine Region
        if (regionValue === 'guess') {
            // Set region based on detected assembly
            if (detectedAssembly === 'hg19') {
                region = 'chr1:155158000-155163000';
            } else if (detectedAssembly === 'hg38') {
                region = 'chr1:155184000-155194000';
            } else {
                throw new Error('Could not determine region based on detected assembly.');
            }
        } else if (regionValue === 'hg19') {
            region = 'chr1:155158000-155163000';
        } else if (regionValue === 'hg38') {
            region = 'chr1:155184000-155194000';
        } else {
            // Assume the regionValue is a custom region string provided by the user
            region = regionValue;
        }

        logMessage(`Region to extract: ${region}`, 'info');

        // Extract Region
        const subsetBamName = `subset_${pair.bam.name}`;
        const subsetBamPath = subsetBamName;
        await extractRegion(CLI, bamPath, region, subsetBamName);

        // Index Subset BAM
        await indexBam(CLI, subsetBamPath);

        // Create Blob for subset BAM
        const subsetBam = await CLI.fs.readFile(subsetBamPath);
        const subsetBamBlob = new Blob([subsetBam], { type: 'application/octet-stream' });
        if (subsetBamBlob.size === 0) {
            logMessage(`Failed to create Blob from subset BAM file ${subsetBamPath}.`, 'error');
            throw new Error(`Failed to create Blob from subset BAM file ${subsetBamPath}.`);
        }
        logMessage(`Created Blob for subset BAM: ${subsetBamPath}`, 'info');

        // Create Blob for subset BAI
        const subsetBaiPath = `${subsetBamPath}.bai`;
        const subsetBai = await CLI.fs.readFile(subsetBaiPath);
        const subsetBaiBlob = new Blob([subsetBai], { type: 'application/octet-stream' });
        if (subsetBaiBlob.size === 0) {
            logMessage(`Failed to create Blob from subset BAI file ${subsetBaiPath}.`, 'error');
            throw new Error(`Failed to create Blob from subset BAI file ${subsetBaiPath}.`);
        }
        logMessage(`Created Blob for subset BAI: ${subsetBaiPath}`, 'info');

        // Collect the Blob and its name to return
        subsetBamAndBaiBlobs.push({
            subsetBamBlob,
            subsetBaiBlob,
            subsetName: subsetBamPath
        });

        logMessage(`Subset BAM and BAI for ${pair.bam.name} created successfully.`, 'success');

        return {
            subsetBamAndBaiBlobs,
            detectedAssembly,
            region
        };

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