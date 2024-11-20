// frontend/ressources/js/bamProcessing.js

/**
 * Initializes Aioli with Samtools.
 * @returns {Promise<Aioli>} - The initialized Aioli CLI object.
 */
export async function initializeAioli() {
    try {
        console.log("Initializing Aioli with Samtools...");
        const CLI = await new Aioli(["samtools/1.17"]);
        console.log("Aioli initialized.");
        console.log("CLI object:", CLI);
        console.log("CLI.fs:", CLI.fs);

        if (!CLI.fs) {
            throw new Error("Failed to initialize the virtual filesystem (CLI.fs is undefined).");
        }

        return CLI;
    } catch (err) {
        console.error("Error initializing Aioli:", err);
        document.getElementById("error").textContent = "Failed to initialize the processing environment.";
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
    console.log("Executing Samtools View Command to extract header:", viewArgs);

    const result = await CLI.exec("samtools", viewArgs);
    const header = result;
    console.log(`Extracted BAM Header for ${bamPath}:\n`, header);

    return header;
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

    console.log("Parsed Contigs:", contigs);
    console.log("Assembly Hints from @PG lines:", assemblyHints);

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
                console.log(`Assembly detected from @PG lines: ${assembly}`);
                return assembly;
            }
        }
    }

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
        console.log(`Assembly ${assembly.name} match: ${Math.round(matchPercentage * 100)}%`);

        if (matchPercentage >= threshold) {
            detectedAssembly = assembly.name;
            break;
        }
    }

    return detectedAssembly;
}

/**
 * Extracts the specified region from BAM files using Samtools and indexes the subset BAM.
 * Also detects the reference genome assembly.
 * @param {Aioli} CLI - The initialized Aioli CLI object.
 * @param {Object[]} matchedPairs - Array of matched BAM and BAI file pairs.
 * @returns {Promise<Object>} - An object containing subset BAM/BAI Blobs and detected assembly.
 */
export async function extractRegionAndIndex(CLI, matchedPairs) {
    // Clear previous region outputs and errors
    document.getElementById("regionOutput").innerHTML = "";
    document.getElementById("error").textContent = "";

    const regionSelect = document.getElementById("region");
    let regionValue = regionSelect.value;

    console.log("Extract Region and Index Function Triggered");
    console.log("Selected Region:", regionValue);

    // Input Validation
    if (!regionValue) {
        document.getElementById("error").textContent = "Please select a region.";
        console.warn("Region selection error: No region selected.");
        throw new Error("No region selected.");
    }

    // Update UI to indicate processing
    const extractBtn = document.getElementById("extractBtn");
    extractBtn.disabled = true;
    extractBtn.textContent = "Processing...";

    let detectedAssembly = null;
    let region = null;

    try {
        // Mount all BAM and BAI files
        console.log("Mounting BAM and BAI files...");
        const filesToMount = [];
        matchedPairs.forEach(pair => {
            filesToMount.push(pair.bam);
            filesToMount.push(pair.bai);
        });
        const paths = await CLI.mount(filesToMount);
        console.log("Mounted Paths:", paths);

        const subsetBamAndBaiBlobs = [];

        // Process each BAM and BAI pair
        for (const pair of matchedPairs) {
            const bamPath = paths.find(p => p.endsWith(pair.bam.name));
            const baiPath = paths.find(p => p.endsWith(pair.bai.name));

            console.log(`Processing BAM: ${bamPath}, BAI: ${baiPath}`);

            // **Extract and Parse BAM Header**
            const header = await extractBamHeader(CLI, bamPath);
            const { contigs: bamContigs, assemblyHints } = parseHeader(header);

            // **Detect Assembly (only once)**
            if (!detectedAssembly) {
                detectedAssembly = detectAssembly(bamContigs, assemblyHints);
                console.log("Detected Assembly:", detectedAssembly);
            }

            // **Determine region**
            if (regionValue === 'guess') {
                // If region is 'guess', set region based on detected assembly
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

            console.log("Region to extract:", region);

            // Extract region using samtools view
            const subsetBamName = `subset_${pair.bam.name}`;
            const subsetBamPath = subsetBamName;
            const viewCommand = "samtools";
            const viewArgs = ["view", "-P", "-b", bamPath, region, "-o", subsetBamPath];
            console.log("Executing Samtools View Command:", viewCommand, viewArgs);

            const viewResult = await CLI.exec(viewCommand, viewArgs);
            console.log("Samtools View Output:", viewResult);

            // Check if subset BAM was created and has content
            const subsetBamStats = await CLI.fs.stat(subsetBamPath);
            console.log(`${subsetBamPath} Stats:`, subsetBamStats);

            if (!subsetBamStats || subsetBamStats.size === 0) {
                throw new Error(`Subset BAM file ${subsetBamPath} was not created or is empty. No reads found in the specified region.`);
            }

            // Index the subset BAM using samtools index
            console.log(`Indexing subset BAM: ${subsetBamPath}`);
            const indexCommand = "samtools";
            const indexArgs = ["index", subsetBamPath];
            const indexResult = await CLI.exec(indexCommand, indexArgs);
            console.log("Samtools Index Output:", indexResult);

            // Check if BAI was created
            const subsetBaiPath = `${subsetBamPath}.bai`;
            const subsetBaiStats = await CLI.fs.stat(subsetBaiPath);
            console.log(`${subsetBaiPath} Stats:`, subsetBaiStats);

            if (!subsetBaiStats || subsetBaiStats.size === 0) {
                throw new Error(`Index BAI file ${subsetBaiPath} was not created or is empty.`);
            }

            // Read the subset BAM file as Uint8Array
            const subsetBam = await CLI.fs.readFile(subsetBamPath);
            console.log(`${subsetBamPath} length:`, subsetBam.length);

            // Create Blob from Uint8Array
            const subsetBamBlob = new Blob([subsetBam], { type: 'application/octet-stream' });
            console.log(`${subsetBamPath} Blob size:`, subsetBamBlob.size);

            if (subsetBamBlob.size === 0) {
                throw new Error(`Failed to create Blob from subset BAM file ${subsetBamPath}.`);
            }

            // Read the subset BAI file as Uint8Array
            const subsetBai = await CLI.fs.readFile(subsetBaiPath);
            console.log(`${subsetBaiPath} length:`, subsetBai.length);

            // Create Blob from Uint8Array
            const subsetBaiBlob = new Blob([subsetBai], { type: 'application/octet-stream' });
            console.log(`${subsetBaiPath} Blob size:`, subsetBaiBlob.size);

            if (subsetBaiBlob.size === 0) {
                throw new Error(`Failed to create Blob from subset BAI file ${subsetBaiPath}.`);
            }

            // Collect the Blob and its name to return
            subsetBamAndBaiBlobs.push({
                subsetBamBlob,
                subsetBaiBlob,
                subsetName: subsetBamPath
            });

            console.log(`Subset BAM and BAI for ${pair.bam.name} created successfully.`);
        }

        return {
            subsetBamAndBaiBlobs,
            detectedAssembly,
            region
        };

    } catch (err) {
        console.error("Error during extraction and indexing:", err);
        document.getElementById("error").textContent = `Error: ${err.message}`;
        throw err;
    } finally {
        // Reset the button
        extractBtn.disabled = false;
        extractBtn.textContent = "Extract Region";
    }
}
