// frontend/resources/js/controllers/ExtractionController.js

import { BaseController } from './BaseController.js';
import { initializeAioli, extractRegionAndIndex } from '../bamProcessing.js';

/**
 * Extraction Controller - Handles BAM file region extraction
 *
 * Purpose: Manages BAM file extraction and indexing using Aioli/samtools.
 *
 * Responsibilities:
 * - Aioli initialization
 * - BAM region extraction
 * - BAI index generation
 * - Assembly detection
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles extraction operations
 * - Open/Closed: Easy to extend with new extraction methods
 * - Dependency Inversion: Depends on abstractions
 *
 * @class ExtractionController
 * @extends BaseController
 */
export class ExtractionController extends BaseController {
    /**
     * @param {Object} dependencies - Injected dependencies
     */
    constructor(dependencies) {
        super(dependencies);

        this.errorView = dependencies.errorView;
        this.cli = null; // Aioli CLI instance
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        this.on('extraction:initialize', this.handleInitialize);
        this.on('extraction:extract', this.handleExtract);
        this.on('files:validated', this.handleFilesValidated);
    }

    /**
     * Handle Aioli initialization
     */
    async handleInitialize() {
        try {
            if (this.cli) {
                this._log('Aioli already initialized', 'info');
                return this.cli;
            }

            this._log('Initializing Aioli', 'info');

            this.cli = await initializeAioli();

            // Store in state
            this.setState('cli', this.cli);

            this.emit('extraction:initialized', { cli: this.cli });

            this._log('Aioli initialized successfully', 'success');

            return this.cli;

        } catch (error) {
            this.handleError(error, 'Aioli initialization failed');
            this.errorView.show(error, 'Aioli Initialization');
            throw error;
        }
    }

    /**
     * Handle files validated event - auto-initialize Aioli
     * @param {Object} params - Event parameters
     * @param {Object[]} params.matchedPairs - Validated file pairs
     */
    async handleFilesValidated({ matchedPairs }) {
        if (matchedPairs.length > 0 && !this.cli) {
            await this.handleInitialize();
        }
    }

    /**
     * Handle BAM extraction
     * @param {Object} params - Extraction parameters
     * @param {Object} params.pair - BAM/BAI file pair
     * @param {File} params.pair.bam - BAM file
     * @param {File} params.pair.bai - BAI file
     * @param {string} [params.region] - Region to extract
     */
    async handleExtract({ pair, region }) {
        try {
            this._log('Extracting BAM region', 'info', { pair, region });

            // Ensure Aioli is initialized
            if (!this.cli) {
                await this.handleInitialize();
            }

            // Extract region and generate index
            const result = await extractRegionAndIndex(this.cli, pair);

            this.emit('extraction:complete', {
                pair,
                result,
                subsetBamAndBaiBlobs: result.subsetBamAndBaiBlobs,
                detectedAssembly: result.detectedAssembly,
                region: result.region
            });

            this._log('BAM extraction complete', 'success', {
                assembly: result.detectedAssembly,
                region: result.region
            });

            return result;

        } catch (error) {
            this.handleError(error, 'BAM extraction failed');
            this.errorView.show(error, 'BAM Extraction');
            throw error;
        }
    }

    /**
     * Extract multiple file pairs
     * @param {Object[]} pairs - Array of BAM/BAI pairs
     * @param {string} [region] - Region to extract
     * @returns {Promise<Object[]>} Array of extraction results
     */
    async extractMultiple(pairs, region) {
        const results = [];

        for (const pair of pairs) {
            try {
                const result = await this.handleExtract({ pair, region });
                results.push(result);
            } catch (error) {
                this._log(`Extraction failed for ${pair.bam.name}`, 'error', error);
                // Continue with other pairs
            }
        }

        return results;
    }

    /**
     * Get CLI instance
     * @returns {Object|null} Aioli CLI instance
     */
    getCLI() {
        return this.cli;
    }

    /**
     * Check if Aioli is initialized
     * @returns {boolean} True if initialized
     */
    isInitialized() {
        return !!this.cli;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Cleanup Aioli resources if needed
        this.cli = null;
        this.setState('cli', null);

        this._log('Cleanup complete', 'info');
    }
}
