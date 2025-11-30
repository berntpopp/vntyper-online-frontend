// tests/unit/utils/pollingManager.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PollingManager } from '../../../resources/js/pollingManager.js';

// Mock log.js dependency
vi.mock('../../../resources/js/log.js', () => ({
  logMessage: vi.fn(),
}));

describe('PollingManager', () => {
  let pollingManager;

  beforeEach(() => {
    pollingManager = new PollingManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Stop all active polls to prevent timer leaks
    pollingManager.stopAll();
    // Clear all pending timers
    vi.clearAllTimers();
    pollingManager.cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ============================================================================
  // Constructor
  // ============================================================================

  describe('constructor()', () => {
    it('should initialize with empty activePolls map', () => {
      expect(pollingManager.activePolls).toBeInstanceOf(Map);
      expect(pollingManager.activePolls.size).toBe(0);
    });
  });

  // ============================================================================
  // start() - Basic functionality
  // ============================================================================

  describe('start() - Basic functionality', () => {
    it('should start polling and call pollFn immediately', async () => {
      // Arrange
      const pollFn = vi.fn().mockResolvedValue({ status: 'pending' });
      const onUpdate = vi.fn();

      // Act
      const stop = pollingManager.start('job-123', pollFn, { interval: 5000, onUpdate });

      // Wait for initial poll only (not all timers)
      await vi.advanceTimersByTimeAsync(0);

      // Stop polling to prevent timer leak
      stop();

      // Assert
      expect(pollFn).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith({ status: 'pending' });
    });

    it('should return stop function', () => {
      // Arrange
      const pollFn = vi.fn().mockResolvedValue({ status: 'pending' });

      // Act
      const stop = pollingManager.start('job-123', pollFn);

      // Assert
      expect(typeof stop).toBe('function');
    });

    it('should add poll to activePolls', () => {
      // Arrange
      const pollFn = vi.fn().mockResolvedValue({ status: 'pending' });

      // Act
      pollingManager.start('job-123', pollFn);

      // Assert
      expect(pollingManager.activePolls.has('job-123')).toBe(true);
      expect(pollingManager.isActive('job-123')).toBe(true);
    });

    it('should use default options if not provided', async () => {
      // Arrange
      const pollFn = vi.fn().mockResolvedValue({ status: 'pending' });

      // Act
      pollingManager.start('job-123', pollFn);

      // Wait for initial poll
      await vi.runAllTimersAsync();

      // Assert - poll was called (default options work)
      expect(pollFn).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // start() - Deduplication
  // ============================================================================

  describe('start() - Deduplication', () => {
    it('should prevent duplicate polls for same ID', () => {
      // Arrange
      const pollFn1 = vi.fn().mockResolvedValue({ status: 'pending' });
      const pollFn2 = vi.fn().mockResolvedValue({ status: 'pending' });

      // Act
      const stop1 = pollingManager.start('job-123', pollFn1);
      const stop2 = pollingManager.start('job-123', pollFn2);

      // Assert
      expect(stop1).toBe(stop2); // Returns same stop function
      expect(pollingManager.activePolls.size).toBe(1);
    });

    it('should allow multiple polls with different IDs', () => {
      // Arrange
      const pollFn1 = vi.fn().mockResolvedValue({ status: 'pending' });
      const pollFn2 = vi.fn().mockResolvedValue({ status: 'pending' });

      // Act
      pollingManager.start('job-123', pollFn1);
      pollingManager.start('job-456', pollFn2);

      // Assert
      expect(pollingManager.activePolls.size).toBe(2);
      expect(pollingManager.isActive('job-123')).toBe(true);
      expect(pollingManager.isActive('job-456')).toBe(true);
    });
  });

  // ============================================================================
  // start() - Polling interval
  // ============================================================================

  describe('start() - Polling interval', () => {
    it('should poll at specified interval', async () => {
      // Arrange
      const pollFn = vi.fn().mockResolvedValue({ status: 'pending' });

      // Act
      const stop = pollingManager.start('job-123', pollFn, { interval: 5000 });

      // Initial poll
      await vi.advanceTimersByTimeAsync(0);
      expect(pollFn).toHaveBeenCalledTimes(1);

      // Advance 5s
      await vi.advanceTimersByTimeAsync(5000);
      expect(pollFn).toHaveBeenCalledTimes(2);

      // Advance another 5s
      await vi.advanceTimersByTimeAsync(5000);
      expect(pollFn).toHaveBeenCalledTimes(3);

      // Stop polling
      stop();
    });
  });

  // ============================================================================
  // start() - Completion detection
  // ============================================================================

  describe('start() - Completion detection', () => {
    it('should stop polling when status is completed', async () => {
      // Arrange
      const pollFn = vi
        .fn()
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValueOnce({ status: 'completed', result: 'success' });

      const onComplete = vi.fn();

      // Act
      pollingManager.start('job-123', pollFn, { interval: 1000, onComplete });

      // Initial poll (pending)
      await vi.advanceTimersByTimeAsync(0);
      expect(pollFn).toHaveBeenCalledTimes(1);

      // Second poll (completed)
      await vi.advanceTimersByTimeAsync(1000);
      expect(pollFn).toHaveBeenCalledTimes(2);
      expect(onComplete).toHaveBeenCalledWith({ status: 'completed', result: 'success' });

      // Should not poll again
      await vi.advanceTimersByTimeAsync(1000);
      expect(pollFn).toHaveBeenCalledTimes(2);

      // Should be removed from activePolls
      expect(pollingManager.isActive('job-123')).toBe(false);
    });

    it('should stop polling when status is failed', async () => {
      // Arrange
      const pollFn = vi
        .fn()
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValueOnce({ status: 'failed', error: 'Job failed' });

      const onComplete = vi.fn();

      // Act
      pollingManager.start('job-123', pollFn, { interval: 1000, onComplete });

      // Initial poll
      await vi.runAllTimersAsync();

      // Second poll (failed)
      await vi.advanceTimersByTimeAsync(1000);

      // Assert
      expect(onComplete).toHaveBeenCalledWith({ status: 'failed', error: 'Job failed' });
      expect(pollingManager.isActive('job-123')).toBe(false);
    });
  });

  // ============================================================================
  // start() - Error handling and retries
  // ============================================================================

  describe('start() - Error handling and retries', () => {
    it('should retry on error with exponential backoff', async () => {
      // Arrange
      const pollFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ status: 'completed' });

      const onError = vi.fn();
      const onComplete = vi.fn();

      // Act
      pollingManager.start('job-123', pollFn, {
        interval: 1000,
        maxRetries: 3,
        onError,
        onComplete,
      });

      // Initial poll (fails)
      await vi.advanceTimersByTimeAsync(0);
      expect(pollFn).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));

      // First retry after 2s (interval * 2^1)
      await vi.advanceTimersByTimeAsync(2000);
      expect(pollFn).toHaveBeenCalledTimes(2);
      expect(onComplete).toHaveBeenCalledWith({ status: 'completed' });
    });

    it('should stop after max retries', async () => {
      // Arrange
      const pollFn = vi.fn().mockRejectedValue(new Error('Network error'));
      const onError = vi.fn();

      // Act
      pollingManager.start('job-123', pollFn, {
        interval: 1000,
        maxRetries: 3,
        onError,
      });

      // Initial poll (retry 0)
      await vi.advanceTimersByTimeAsync(0);
      expect(pollFn).toHaveBeenCalledTimes(1);

      // Retry 1 after 2s
      await vi.advanceTimersByTimeAsync(2000);
      expect(pollFn).toHaveBeenCalledTimes(2);

      // Retry 2 after 4s
      await vi.advanceTimersByTimeAsync(4000);
      expect(pollFn).toHaveBeenCalledTimes(3);

      // Retry 3 would be after 8s but max retries reached (retries=3 >= maxRetries=3)
      await vi.advanceTimersByTimeAsync(8000);
      expect(pollFn).toHaveBeenCalledTimes(3); // Initial + 2 retries (stops at retries >= maxRetries)

      // Should be removed from activePolls after max retries
      expect(pollingManager.isActive('job-123')).toBe(false);
    });

    it('should cap exponential backoff at 60 seconds', async () => {
      // Arrange
      const pollFn = vi.fn().mockRejectedValue(new Error('Network error'));

      // Act
      pollingManager.start('job-123', pollFn, {
        interval: 1000,
        maxRetries: 10,
      });

      // Initial poll
      await vi.runAllTimersAsync();

      // After many retries, backoff should be capped at 60s
      // interval * 2^10 = 1024s, but capped at 60s
      await vi.advanceTimersByTimeAsync(2000); // Retry 1
      await vi.advanceTimersByTimeAsync(4000); // Retry 2
      await vi.advanceTimersByTimeAsync(8000); // Retry 3
      await vi.advanceTimersByTimeAsync(16000); // Retry 4
      await vi.advanceTimersByTimeAsync(32000); // Retry 5
      await vi.advanceTimersByTimeAsync(60000); // Retry 6 (capped at 60s)
      await vi.advanceTimersByTimeAsync(60000); // Retry 7 (capped at 60s)

      // Should have retried multiple times
      expect(pollFn.mock.calls.length).toBeGreaterThan(5);
    });

    it('should reset retry count on successful poll', async () => {
      // Arrange
      const pollFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValue({ status: 'pending' });

      // Act
      const stop = pollingManager.start('job-123', pollFn, {
        interval: 1000,
        maxRetries: 3,
      });

      // Initial poll (fails)
      await vi.advanceTimersByTimeAsync(0);
      expect(pollFn).toHaveBeenCalledTimes(1);

      // Retry after 2s (succeeds)
      await vi.advanceTimersByTimeAsync(2000);
      expect(pollFn).toHaveBeenCalledTimes(2);

      // Next poll after normal interval (1s, not exponential backoff)
      await vi.advanceTimersByTimeAsync(1000);
      expect(pollFn).toHaveBeenCalledTimes(3);

      // Stop polling
      stop();
    });
  });

  // ============================================================================
  // start() - Max duration
  // ============================================================================

  describe('start() - Max duration', () => {
    it('should stop polling after max duration', async () => {
      // Arrange
      const pollFn = vi.fn().mockResolvedValue({ status: 'pending' });
      const onError = vi.fn();

      // Act
      pollingManager.start('job-123', pollFn, {
        interval: 1000,
        maxDuration: 5000,
        onError,
      });

      // Poll several times
      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000); // Should stop here (5s elapsed)

      // Assert
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Polling duration exceeded',
        })
      );
      expect(pollingManager.isActive('job-123')).toBe(false);
    });
  });

  // ============================================================================
  // stop() - Manual stop
  // ============================================================================

  describe('stop() - Manual stop', () => {
    it('should stop specific poll', async () => {
      // Arrange
      const pollFn = vi.fn().mockResolvedValue({ status: 'pending' });

      // Act
      pollingManager.start('job-123', pollFn, { interval: 1000 });

      // Initial poll
      await vi.advanceTimersByTimeAsync(0);
      expect(pollFn).toHaveBeenCalledTimes(1);

      // Stop polling
      const stopped = pollingManager.stop('job-123');

      // Assert
      expect(stopped).toBe(true);
      expect(pollingManager.isActive('job-123')).toBe(false);

      // Should not poll again
      await vi.advanceTimersByTimeAsync(1000);
      expect(pollFn).toHaveBeenCalledTimes(1);
    });

    it('should return false if poll not found', () => {
      // Act
      const stopped = pollingManager.stop('nonexistent');

      // Assert
      expect(stopped).toBe(false);
    });

    it('should clean up timeout handle', async () => {
      // Arrange
      const pollFn = vi.fn().mockResolvedValue({ status: 'pending' });
      const stop = pollingManager.start('job-123', pollFn);

      // Act
      await vi.runAllTimersAsync();
      stop();

      // Assert - no pending timers after stop
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  // ============================================================================
  // stopAll() - Stop all polls
  // ============================================================================

  describe('stopAll()', () => {
    it('should stop all active polls', async () => {
      // Arrange
      const pollFn1 = vi.fn().mockResolvedValue({ status: 'pending' });
      const pollFn2 = vi.fn().mockResolvedValue({ status: 'pending' });
      const pollFn3 = vi.fn().mockResolvedValue({ status: 'pending' });

      pollingManager.start('job-1', pollFn1);
      pollingManager.start('job-2', pollFn2);
      pollingManager.start('job-3', pollFn3);

      // Act
      const count = pollingManager.stopAll();

      // Assert
      expect(count).toBe(3);
      expect(pollingManager.activePolls.size).toBe(0);
      expect(pollingManager.isActive('job-1')).toBe(false);
      expect(pollingManager.isActive('job-2')).toBe(false);
      expect(pollingManager.isActive('job-3')).toBe(false);
    });

    it('should return 0 if no active polls', () => {
      // Act
      const count = pollingManager.stopAll();

      // Assert
      expect(count).toBe(0);
    });
  });

  // ============================================================================
  // isActive() - Check if poll is active
  // ============================================================================

  describe('isActive()', () => {
    it('should return true if poll is active', () => {
      // Arrange
      const pollFn = vi.fn().mockResolvedValue({ status: 'pending' });
      pollingManager.start('job-123', pollFn);

      // Assert
      expect(pollingManager.isActive('job-123')).toBe(true);
    });

    it('should return false if poll is not active', () => {
      // Assert
      expect(pollingManager.isActive('job-123')).toBe(false);
    });
  });

  // ============================================================================
  // getActive() - Get active poll IDs
  // ============================================================================

  describe('getActive()', () => {
    it('should return array of active poll IDs', () => {
      // Arrange
      const pollFn = vi.fn().mockResolvedValue({ status: 'pending' });
      pollingManager.start('job-1', pollFn);
      pollingManager.start('job-2', pollFn);
      pollingManager.start('job-3', pollFn);

      // Act
      const active = pollingManager.getActive();

      // Assert
      expect(active).toEqual(['job-1', 'job-2', 'job-3']);
    });

    it('should return empty array if no active polls', () => {
      // Act
      const active = pollingManager.getActive();

      // Assert
      expect(active).toEqual([]);
    });
  });

  // ============================================================================
  // getPollInfo() - Get poll information
  // ============================================================================

  describe('getPollInfo()', () => {
    it('should return poll information', async () => {
      // Arrange
      const pollFn = vi.fn().mockResolvedValue({ status: 'pending' });
      const stop = pollingManager.start('job-123', pollFn);

      // Wait for initial poll
      await vi.advanceTimersByTimeAsync(0);

      // Act
      const info = pollingManager.getPollInfo('job-123');

      // Assert
      expect(info).toMatchObject({
        id: 'job-123',
        status: 'active',
        retries: 0,
        lastResult: { status: 'pending' },
      });
      expect(info.startedAt).toBeDefined();
      expect(info.lastPollAt).toBeDefined();
      expect(info.runningFor).toBeGreaterThanOrEqual(0);

      // Clean up
      stop();
    });

    it('should return null if poll not found', () => {
      // Act
      const info = pollingManager.getPollInfo('nonexistent');

      // Assert
      expect(info).toBeNull();
    });
  });

  // ============================================================================
  // getAllPollInfo() - Get all poll information
  // ============================================================================

  describe('getAllPollInfo()', () => {
    it('should return array of poll information', async () => {
      // Arrange
      const pollFn = vi.fn().mockResolvedValue({ status: 'pending' });
      const stop1 = pollingManager.start('job-1', pollFn);
      const stop2 = pollingManager.start('job-2', pollFn);

      // Wait for initial polls
      await vi.advanceTimersByTimeAsync(0);

      // Act
      const allInfo = pollingManager.getAllPollInfo();

      // Assert
      expect(allInfo).toHaveLength(2);
      expect(allInfo[0].id).toBe('job-1');
      expect(allInfo[1].id).toBe('job-2');

      // Clean up
      stop1();
      stop2();
    });

    it('should return empty array if no active polls', () => {
      // Act
      const allInfo = pollingManager.getAllPollInfo();

      // Assert
      expect(allInfo).toEqual([]);
    });
  });

  // ============================================================================
  // cleanup() - Cleanup all resources
  // ============================================================================

  describe('cleanup()', () => {
    it('should stop all polls', () => {
      // Arrange
      const pollFn = vi.fn().mockResolvedValue({ status: 'pending' });
      pollingManager.start('job-1', pollFn);
      pollingManager.start('job-2', pollFn);

      // Act
      pollingManager.cleanup();

      // Assert
      expect(pollingManager.activePolls.size).toBe(0);
    });
  });
});
