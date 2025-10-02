// frontend/resources/js/blobManager.js

import { logMessage } from './log.js';

/**
 * Manages Blob URLs with automatic cleanup to prevent memory leaks
 *
 * Problem: URL.createObjectURL() creates a reference that stays in memory
 * until manually revoked or page unload. Without cleanup, large files (BAM/BAI)
 * can leak hundreds of MB of memory.
 *
 * Solution: Centralized manager that tracks all blob URLs and provides
 * automatic cleanup mechanisms.
 *
 * @class BlobURLManager
 */
export class BlobURLManager {
    constructor() {
        this.urls = new Map();  // url -> { blob, timestamp, metadata }
        this.autoCleanupInterval = null;
    }

    /**
     * Create a blob URL and track it for automatic cleanup
     * @param {Blob} blob - The blob to create URL for
     * @param {Object} metadata - Optional metadata (filename, type, etc.)
     * @returns {string} - The blob URL
     *
     * @example
     * const url = blobManager.create(myBlob, { filename: 'data.bam' });
     * // Later, manually revoke:
     * blobManager.revoke(url);
     * // Or rely on automatic cleanup
     */
    create(blob, metadata = {}) {
        if (!(blob instanceof Blob)) {
            throw new Error('[BlobURLManager] Invalid blob provided');
        }

        const url = URL.createObjectURL(blob);
        this.urls.set(url, {
            blob,
            timestamp: Date.now(),
            size: blob.size,
            type: blob.type,
            metadata
        });

        logMessage(
            `Created Blob URL (${(blob.size / 1024 / 1024).toFixed(2)}MB): ${metadata.filename || 'unnamed'}`,
            'info'
        );

        return url;
    }

    /**
     * Revoke a specific blob URL and remove from tracking
     * @param {string} url - The URL to revoke
     * @returns {boolean} - True if revoked, false if not found
     */
    revoke(url) {
        if (!this.urls.has(url)) {
            console.warn(`[BlobURLManager] URL not tracked: ${url}`);
            return false;
        }

        const data = this.urls.get(url);
        URL.revokeObjectURL(url);
        this.urls.delete(url);

        logMessage(
            `Revoked Blob URL (${(data.size / 1024 / 1024).toFixed(2)}MB): ${data.metadata.filename || 'unnamed'}`,
            'info'
        );

        return true;
    }

    /**
     * Revoke multiple blob URLs
     * @param {string[]} urls - Array of URLs to revoke
     * @returns {number} - Number of URLs revoked
     */
    revokeMultiple(urls) {
        let revokedCount = 0;
        for (const url of urls) {
            if (this.revoke(url)) {
                revokedCount++;
            }
        }
        return revokedCount;
    }

    /**
     * Revoke all tracked blob URLs
     * @returns {number} - Number of URLs revoked
     */
    revokeAll() {
        const count = this.urls.size;
        let totalSize = 0;

        for (const [url, data] of this.urls.entries()) {
            totalSize += data.size;
            URL.revokeObjectURL(url);
        }

        this.urls.clear();

        if (count > 0) {
            logMessage(
                `Revoked ${count} Blob URLs, freed ${(totalSize / 1024 / 1024).toFixed(2)}MB`,
                'info'
            );
        }

        return count;
    }

    /**
     * Revoke URLs older than maxAge milliseconds
     * @param {number} maxAge - Max age in milliseconds (default: 5 minutes)
     * @returns {number} - Number of URLs revoked
     */
    revokeOld(maxAge = 300000) {
        const now = Date.now();
        const urlsToRevoke = [];

        for (const [url, data] of this.urls.entries()) {
            if (now - data.timestamp > maxAge) {
                urlsToRevoke.push(url);
            }
        }

        return this.revokeMultiple(urlsToRevoke);
    }

    /**
     * Get all tracked URLs with metadata
     * @returns {Array} - Array of { url, size, type, metadata, timestamp, age }
     */
    getAll() {
        const now = Date.now();
        return Array.from(this.urls.entries()).map(([url, data]) => ({
            url,
            size: data.size,
            type: data.type,
            metadata: data.metadata,
            timestamp: data.timestamp,
            age: now - data.timestamp
        }));
    }

    /**
     * Get total memory used by tracked blobs
     * @returns {number} - Total size in bytes
     */
    getTotalSize() {
        let total = 0;
        for (const data of this.urls.values()) {
            total += data.size;
        }
        return total;
    }

    /**
     * Start automatic cleanup of old URLs
     * @param {number} checkInterval - How often to check (default: 60 seconds)
     * @param {number} maxAge - Max age of URLs (default: 5 minutes)
     */
    startAutoCleanup(checkInterval = 60000, maxAge = 300000) {
        if (this.autoCleanupInterval) {
            clearInterval(this.autoCleanupInterval);
        }

        this.autoCleanupInterval = setInterval(() => {
            const revoked = this.revokeOld(maxAge);
            if (revoked > 0) {
                logMessage(`Auto-cleanup: Revoked ${revoked} old Blob URLs`, 'info');
            }
        }, checkInterval);

        logMessage('Started automatic Blob URL cleanup', 'info');
    }

    /**
     * Stop automatic cleanup
     */
    stopAutoCleanup() {
        if (this.autoCleanupInterval) {
            clearInterval(this.autoCleanupInterval);
            this.autoCleanupInterval = null;
            logMessage('Stopped automatic Blob URL cleanup', 'info');
        }
    }

    /**
     * Cleanup all resources
     */
    cleanup() {
        this.stopAutoCleanup();
        this.revokeAll();
    }
}

// Create singleton instance
export const blobManager = new BlobURLManager();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    blobManager.cleanup();
});

// Start automatic cleanup (check every 60 seconds, revoke URLs older than 5 minutes)
blobManager.startAutoCleanup(60000, 300000);
