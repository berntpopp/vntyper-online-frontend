// frontend/resources/js/models/Cohort.js

/**
 * Cohort Model
 *
 * Purpose: Encapsulates cohort data and business logic for managing
 * groups of related jobs. Implements Value Object pattern.
 *
 * Benefits:
 * - Encapsulation: Cohort data and logic in one place
 * - Validation: Ensures data integrity
 * - Type Safety: Clear structure
 * - Immutability: Creates new instances instead of modifying
 *
 * SOLID Principles:
 * - Single Responsibility: Manages cohort data and validation
 * - Open/Closed: Easy to extend with new cohort types
 *
 * @class Cohort
 */
export class Cohort {
    /**
     * @param {Object} data - Cohort data
     * @param {string} data.cohortId - Unique cohort identifier
     * @param {string} [data.alias] - Human-readable cohort alias
     * @param {string[]} [data.jobIds=[]] - Associated job IDs
     * @param {boolean} [data.hasPassphrase=false] - Whether cohort is protected
     * @param {string} [data.shareableLink] - Shareable link
     * @param {Object} [data.metadata={}] - Additional metadata
     * @param {number} [data.createdAt] - Creation timestamp
     * @param {number} [data.updatedAt] - Last update timestamp
     */
    constructor(data) {
        this.validateCohortId(data.cohortId);

        this.cohortId = data.cohortId;
        this.alias = data.alias || null;
        this.jobIds = Array.isArray(data.jobIds) ? [...data.jobIds] : [];
        this.hasPassphrase = data.hasPassphrase || false;
        this.shareableLink = data.shareableLink || null;
        this.metadata = data.metadata || {};
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = data.updatedAt || Date.now();

        // Polling state
        this.pollStop = data.pollStop || null;
        this.isPolling = data.isPolling || false;

        // Analysis state
        this.analysisJobId = data.analysisJobId || null;
        this.analysisStatus = data.analysisStatus || null;
    }

    /**
     * Validate cohort ID format
     * @param {string} cohortId - Cohort ID to validate
     * @throws {Error} If cohort ID is invalid
     */
    validateCohortId(cohortId) {
        if (!cohortId || typeof cohortId !== 'string') {
            throw new Error('Cohort ID must be a non-empty string');
        }

        // UUID v4 format validation
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(cohortId)) {
            throw new Error(`Invalid cohort ID format: ${cohortId}`);
        }
    }

    /**
     * Add a job to the cohort
     * @param {string} jobId - Job ID to add
     * @returns {Cohort} New cohort instance
     */
    addJob(jobId) {
        if (this.jobIds.includes(jobId)) {
            return this;
        }

        return new Cohort({
            ...this.toJSON(),
            jobIds: [...this.jobIds, jobId],
            updatedAt: Date.now()
        });
    }

    /**
     * Remove a job from the cohort
     * @param {string} jobId - Job ID to remove
     * @returns {Cohort} New cohort instance
     */
    removeJob(jobId) {
        return new Cohort({
            ...this.toJSON(),
            jobIds: this.jobIds.filter(id => id !== jobId),
            updatedAt: Date.now()
        });
    }

    /**
     * Check if cohort has a specific job
     * @param {string} jobId - Job ID to check
     * @returns {boolean} True if cohort contains the job
     */
    hasJob(jobId) {
        return this.jobIds.includes(jobId);
    }

    /**
     * Get number of jobs in cohort
     * @returns {number} Job count
     */
    getJobCount() {
        return this.jobIds.length;
    }

    /**
     * Check if cohort is empty
     * @returns {boolean} True if no jobs
     */
    isEmpty() {
        return this.jobIds.length === 0;
    }

    /**
     * Check if cohort has alias
     * @returns {boolean} True if alias is set
     */
    hasAlias() {
        return !!this.alias;
    }

    /**
     * Get display name (alias or cohort ID)
     * @returns {string} Display name
     */
    getDisplayName() {
        return this.alias || this.cohortId;
    }

    /**
     * Update alias
     * @param {string} alias - New alias
     * @returns {Cohort} New cohort instance
     */
    updateAlias(alias) {
        return new Cohort({
            ...this.toJSON(),
            alias,
            updatedAt: Date.now()
        });
    }

    /**
     * Update shareable link
     * @param {string} link - Shareable link
     * @returns {Cohort} New cohort instance
     */
    updateShareableLink(link) {
        return new Cohort({
            ...this.toJSON(),
            shareableLink: link,
            updatedAt: Date.now()
        });
    }

    /**
     * Start cohort analysis
     * @param {string} analysisJobId - Analysis job ID
     * @returns {Cohort} New cohort instance
     */
    startAnalysis(analysisJobId) {
        return new Cohort({
            ...this.toJSON(),
            analysisJobId,
            analysisStatus: 'pending',
            updatedAt: Date.now()
        });
    }

    /**
     * Update analysis status
     * @param {string} status - New status
     * @returns {Cohort} New cohort instance
     */
    updateAnalysisStatus(status) {
        return new Cohort({
            ...this.toJSON(),
            analysisStatus: status,
            updatedAt: Date.now()
        });
    }

    /**
     * Check if analysis is complete
     * @returns {boolean} True if analysis is completed
     */
    isAnalysisComplete() {
        return this.analysisStatus === 'completed';
    }

    /**
     * Check if analysis has failed
     * @returns {boolean} True if analysis failed
     */
    isAnalysisFailed() {
        return this.analysisStatus === 'failed';
    }

    /**
     * Get cohort age in milliseconds
     * @returns {number} Age in ms since creation
     */
    getAge() {
        return Date.now() - this.createdAt;
    }

    /**
     * Convert to plain object
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            cohortId: this.cohortId,
            alias: this.alias,
            jobIds: [...this.jobIds],
            hasPassphrase: this.hasPassphrase,
            shareableLink: this.shareableLink,
            metadata: this.metadata,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            pollStop: this.pollStop,
            isPolling: this.isPolling,
            analysisJobId: this.analysisJobId,
            analysisStatus: this.analysisStatus
        };
    }

    /**
     * Create Cohort from API response
     * @param {Object} apiData - API response data
     * @returns {Cohort} New cohort instance
     */
    static fromAPI(apiData) {
        return new Cohort({
            cohortId: apiData.cohort_id || apiData.cohortId,
            alias: apiData.alias,
            jobIds: apiData.job_ids || apiData.jobIds || [],
            hasPassphrase: apiData.has_passphrase || apiData.hasPassphrase || false,
            shareableLink: apiData.shareable_link || apiData.shareableLink,
            metadata: apiData.metadata || {},
            createdAt: apiData.created_at || apiData.createdAt,
            updatedAt: apiData.updated_at || apiData.updatedAt
        });
    }

    /**
     * Clone cohort with optional updates
     * @param {Object} updates - Properties to update
     * @returns {Cohort} New cohort instance
     */
    clone(updates = {}) {
        return new Cohort({
            ...this.toJSON(),
            ...updates
        });
    }

    /**
     * String representation
     * @returns {string} String representation
     */
    toString() {
        const name = this.alias || this.cohortId;
        return `Cohort(${name}, jobs=${this.jobIds.length})`;
    }
}
