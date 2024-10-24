// frontend/ressources/js/bamProcessing.js

/**
 * Initializes Aioli with Samtools.
 * @returns {Promise<Aioli>} - The initialized Aioli CLI object.
 */
export async function initializeAioli() {
    try {
        console.log("Initializing Aioli with Samtools...");
        const CLI = await new Aioli(["samtools/1.10"]);
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
 * Extracts the specified region from BAM files using Samtools.
 * @param {Aioli} CLI - The initialized Aioli CLI object.
 * @param {Object[]} matchedPairs - Array of matched BAM and BAI file pairs.
 */
export async function extractRegion(CLI, matchedPairs) {
    // Clear previous outputs
    document.getElementById("output").innerHTML = "";
    document.getElementById("error").textContent = "";

    const region = document.getElementById("region").value;

    console.log("Extract Region Function Triggered");
    console.log("Selected Region:", region);

    // Input Validation
    if (!region) {
        document.getElementById("error").textContent = "Please select a region.";
        console.warn("Region selection error: No region selected.");
        return;
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

        // Process each BAM and BAI pair
        for (const pair of matchedPairs) {
            const bamPath = paths.find(p => p.endsWith(pair.bam.name));
            const baiPath = paths.find(p => p.endsWith(pair.bai.name));

            console.log(`Processing BAM: ${bamPath}, BAI: ${baiPath}`);

            // Extract region using samtools view
            const outputPath = `subset_${pair.bam.name}`;
            const command = "samtools";
            const args = ["view", "-b", bamPath, region, "-o", outputPath];
            console.log("Executing Command:", command, args);

            const result = await CLI.exec(command, args);
            console.log("Samtools View Output:", result);

            // Check if subset BAM was created and has content
            const subsetStats = await CLI.fs.stat(outputPath);
            console.log(`${outputPath} Stats:`, subsetStats);

            if (!subsetStats || subsetStats.size === 0) {
                throw new Error(`Subset BAM file ${outputPath} was not created or is empty. No reads found in the specified region.`);
            }

            // Read the subset BAM file as Uint8Array
            const subsetBam = await CLI.fs.readFile(outputPath);
            console.log(`${outputPath} length:`, subsetBam.length);

            // Create Blob from Uint8Array
            const subsetBlob = new Blob([subsetBam], { type: 'application/octet-stream' });
            console.log(`${outputPath} Blob size:`, subsetBlob.size);

            if (subsetBlob.size === 0) {
                throw new Error(`Failed to create Blob from subset BAM file ${outputPath}.`);
            }

            // Create an Object URL from the Blob
            const downloadUrl = URL.createObjectURL(subsetBlob);
            console.log("Download URL:", downloadUrl);

            // Create and append the download link
            const downloadLink = document.createElement("a");
            downloadLink.href = downloadUrl;
            downloadLink.download = `subset_${pair.bam.name}`;
            downloadLink.textContent = `Download subset_${pair.bam.name}`;
            downloadLink.classList.add("download-link");

            document.getElementById("output").appendChild(downloadLink);

            console.log("Download link created successfully.");
        }

        // Optional: Revoke the Object URLs after some time to free memory
        setTimeout(() => {
            document.querySelectorAll('#output a').forEach(link => {
                URL.revokeObjectURL(link.href);
                console.log(`Object URL revoked for ${link.download}`);
            });
        }, 60000); // Revoke after 60 seconds

    } catch (err) {
        console.error("Error during extraction:", err);
        document.getElementById("error").textContent = `Error: ${err.message}`;
    } finally {
        // Reset the button
        extractBtn.disabled = false;
        extractBtn.textContent = "Extract Region";
    }
}
