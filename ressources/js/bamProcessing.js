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
 * Extracts the specified region from BAM files using Samtools and indexes the subset BAM.
 * @param {Aioli} CLI - The initialized Aioli CLI object.
 * @param {Object[]} matchedPairs - Array of matched BAM and BAI file pairs.
 * @returns {Promise<Array<{ subsetBamBlob: Blob, subsetBaiBlob: Blob, subsetName: string }>>} - Array of subsetted BAM and BAI Blobs with their names.
 */
export async function extractRegionAndIndex(CLI, matchedPairs) {
    // Clear previous region outputs and errors
    document.getElementById("regionOutput").innerHTML = "";
    document.getElementById("error").textContent = "";

    const region = document.getElementById("region").value;

    console.log("Extract Region and Index Function Triggered");
    console.log("Selected Region:", region);

    // Input Validation
    if (!region) {
        document.getElementById("error").textContent = "Please select a region.";
        console.warn("Region selection error: No region selected.");
        throw new Error("No region selected.");
    }

    // Update UI to indicate processing
    const extractBtn = document.getElementById("extractBtn");
    extractBtn.disabled = true;
    extractBtn.textContent = "Processing...";

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

        return subsetBamAndBaiBlobs;

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
