// frontend/resources/js/models/Job.js

/**
 * Job Model
 *
 * Purpose: Encapsulates job data and business logic, providing a clean
 * interface for job operations. Implements Value Object pattern.
 *
 * Benefits:
 * - Encapsulation: Job data and logic in one place
 * - Validation: Ensures data integrity
 * - Type Safety: Clear structure and validation
 * - Immutability: Creates new instances instead of modifying
 *
 * SOLID Principles:
 * - Single Responsibility: Manages job data and validation
 * - Open/Closed: Easy to extend with new job types
 * - Liskov Substitution: Can be extended for specific job types
 *
 * @class Job
 */
export class Job {
    /**
     * Job statuses
     */
    static STATUS = {
        PENDING: 'pending',
        QUEUED: 'queued',
        STARTED: 'started',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        FAILED: 'failed',
        CANCELLED: 'cancelled'
    };

    /**
     * @param {Object} data - Job data
     * @param {string} data.jobId - Unique job identifier
     * @param {string} [data.status='pending'] - Job status
     * @param {string} [data.fileName] - Input file name
     * @param {string} [data.email] - User email for notifications
     * @param {string} [data.cohortId] - Associated cohort ID
     * @param {Object} [data.options={}] - Job options
     * @param {Object} [data.result] - Job result data
     * @param {Error} [data.error] - Job error
     * @param {number} [data.createdAt] - Creation timestamp
     * @param {number} [data.updatedAt] - Last update timestamp
     */
    constructor(data) {
        this.validateJobId(data.jobId);

        this.jobId = data.jobId;
        this.status = data.status || Job.STATUS.PENDING;
        this.fileName = data.fileName || null;
        this.email = data.email || null;
        this.cohortId = data.cohortId || null;
        this.options = data.options || {};
        this.result = data.result || null;
        this.error = data.error || null;
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = data.updatedAt || Date.now();

        // Polling state
        this.pollStop = data.pollStop || null;
        this.pollInterval = data.pollInterval || 5000;
        this.retryCount = data.retryCount || 0;
        this.maxRetries = data.maxRetries || 10;

        // Additional metadata
        this.metadata = data.metadata || {};
    }

    /**
     * Validate job ID format
     * @param {string} jobId - Job ID to validate
     * @throws {Error} If job ID is invalid
     */
    validateJobId(jobId) {
        if (!jobId || typeof jobId !== 'string') {
            throw new Error('Job ID must be a non-empty string');
        }

        // UUID v4 format validation (optional - depends on backend format)
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(jobId)) {
            throw new Error(`Invalid job ID format: ${jobId}`);
        }
    }

    /**
     * Update job status
     * @param {string} status - New status
     * @returns {Job} New job instance with updated status
     */
    updateStatus(status) {
        if (!Object.values(Job.STATUS).includes(status)) {
            throw new Error(`Invalid job status: ${status}`);
        }

        return new Job({
            ...this.toJSON(),
            status,
            updatedAt: Date.now()
        });
    }

    /**
     * Mark job as completed
     * @param {Object} result - Job result data
     * @returns {Job} New job instance
     */
    complete(result) {
        return new Job({
            ...this.toJSON(),
            status: Job.STATUS.COMPLETED,
            result,
            updatedAt: Date.now()
        });
    }

    /**
     * Mark job as failed
     * @param {Error|string} error - Error information
     * @returns {Job} New job instance
     */
    fail(error) {
        const errorData = error instanceof Error
            ? { message: error.message, stack: error.stack }
            : { message: String(error) };

        return new Job({
            ...this.toJSON(),
            status: Job.STATUS.FAILED,
            error: errorData,
            updatedAt: Date.now()
        });
    }

    /**
     * Check if job is in a terminal state
     * @returns {boolean} True if job is completed, failed, or cancelled
     */
    isTerminal() {
        return [
            Job.STATUS.COMPLETED,
            Job.STATUS.FAILED,
            Job.STATUS.CANCELLED
        ].includes(this.status);
    }

    /**
     * Check if job is active (running or queued)
     * @returns {boolean} True if job is active
     */
    isActive() {
        return [
            Job.STATUS.QUEUED,
            Job.STATUS.STARTED,
            Job.STATUS.PROCESSING
        ].includes(this.status);
    }

    /**
     * Check if job is pending
     * @returns {boolean} True if job is pending
     */
    isPending() {
        return this.status === Job.STATUS.PENDING;
    }

    /**
     * Check if job is completed successfully
     * @returns {boolean} True if job is completed
     */
    isCompleted() {
        return this.status === Job.STATUS.COMPLETED;
    }

    /**
     * Check if job has failed
     * @returns {boolean} True if job has failed
     */
    isFailed() {
        return this.status === Job.STATUS.FAILED;
    }

    /**
     * Get job duration in milliseconds
     * @returns {number} Duration in ms
     */
    getDuration() {
        return this.updatedAt - this.createdAt;
    }

    /**
     * Get job age in milliseconds
     * @returns {number} Age in ms since creation
     */
    getAge() {
        return Date.now() - this.createdAt;
    }

    /**
     * Check if job can be retried
     * @returns {boolean} True if job can be retried
     */
    canRetry() {
        return this.isFailed() && this.retryCount < this.maxRetries;
    }

    /**
     * Increment retry count
     * @returns {Job} New job instance with incremented retry count
     */
    incrementRetry() {
        return new Job({
            ...this.toJSON(),
            retryCount: this.retryCount + 1,
            updatedAt: Date.now()
        });
    }

    /**
     * Convert to plain object
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            jobId: this.jobId,
            status: this.status,
            fileName: this.fileName,
            email: this.email,
            cohortId: this.cohortId,
            options: this.options,
            result: this.result,
            error: this.error,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            pollStop: this.pollStop,
            pollInterval: this.pollInterval,
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
            metadata: this.metadata
        };
    }

    /**
     * Create Job from API response
     * @param {Object} apiData - API response data
     * @returns {Job} New job instance
     */
    static fromAPI(apiData) {
        return new Job({
            jobId: apiData.job_id || apiData.jobId,
            status: apiData.status || Job.STATUS.PENDING, // Default to pending if not provided
            fileName: apiData.file_name || apiData.fileName,
            email: apiData.email,
            cohortId: apiData.cohort_id || apiData.cohortId,
            options: apiData.options || {},
            result: apiData.result,
            error: apiData.error,
            createdAt: apiData.created_at || apiData.createdAt,
            updatedAt: apiData.updated_at || apiData.updatedAt
        });
    }

    /**
     * Create Job from form data
     * @param {FormData} formData - Form data
     * @param {string} jobId - Generated job ID
     * @returns {Job} New job instance
     */
    static fromFormData(formData, jobId) {
        const file = formData.get('file');

        return new Job({
            jobId,
            status: Job.STATUS.PENDING,
            fileName: file ? file.name : null,
            email: formData.get('email'),
            cohortId: formData.get('cohort_id'),
            options: {
                advntr_mode: formData.get('advntr_mode') === 'true',
                archive: formData.get('archive') === 'true',
                keep_intermediates: formData.get('keep_intermediates') === 'true'
            }
        });
    }

    /**
     * Clone job with optional updates
     * @param {Object} updates - Properties to update
     * @returns {Job} New job instance
     */
    clone(updates = {}) {
        return new Job({
            ...this.toJSON(),
            ...updates
        });
    }

    /**
     * String representation
     * @returns {string} String representation
     */
    toString() {
        return `Job(${this.jobId}, status=${this.status}, file=${this.fileName})`;
    }
}
