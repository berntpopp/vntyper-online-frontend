// tests/unit/pollingContract.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PollingManager } from '../../resources/js/pollingManager.js';
import { JobController } from '../../resources/js/controllers/JobController.js';
import { CohortController } from '../../resources/js/controllers/CohortController.js';

vi.mock('../../resources/js/log.js', () => ({ logMessage: vi.fn() }));
vi.mock('../../resources/js/uiUtils.js', () => ({
  showSpinner: vi.fn(),
  hideSpinner: vi.fn(),
  startCountdown: vi.fn(),
  clearCountdown: vi.fn(),
}));

/**
 * Contract between PollingManager and its consumers.
 *
 * The controllers branch on `context.willRetry`. Both suites would stay green
 * if that key were renamed on one side only, so this pins the actual shape
 * PollingManager emits and feeds it through the real consumer handlers.
 */
describe('PollingManager -> controller onError contract', () => {
  let pollingManager;

  beforeEach(() => {
    pollingManager = new PollingManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    pollingManager.stopAll();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function captureContexts() {
    const contexts = [];
    const pollFn = vi.fn().mockRejectedValue(new Error('network'));
    pollingManager.start('contract', pollFn, {
      interval: 1000,
      maxRetries: 2,
      onError: (_error, context) => contexts.push(context),
    });
    return contexts;
  }

  it('emits exactly the keys the controllers read', async () => {
    const contexts = captureContexts();
    await vi.advanceTimersByTimeAsync(0);

    expect(Object.keys(contexts[0]).sort()).toEqual(['maxRetries', 'retries', 'willRetry']);
    expect(typeof contexts[0].willRetry).toBe('boolean');
  });

  it('drives JobController from transient to terminal without a false failure', async () => {
    const stateManager = { updateJobStatus: vi.fn() };
    const jobView = {
      updateStatus: vi.fn(),
      hideDownloadLink: vi.fn(),
      showError: vi.fn(),
      showDownloadLink: vi.fn(),
      showJob: vi.fn(),
    };
    const emitted = [];
    const controller = new JobController({
      eventBus: { on: vi.fn(() => vi.fn()), emit: (e, p) => emitted.push([e, p]) },
      stateManager,
      apiService: {},
      jobView,
      errorView: { show: vi.fn() },
      pollingManager,
      logger: { logMessage: vi.fn() },
    });

    const pollFn = vi.fn().mockRejectedValue(new Error('network'));
    pollingManager.start('job-contract', pollFn, {
      interval: 1000,
      maxRetries: 2,
      onError: (error, context) => controller.handlePollError('job-contract', error, context),
    });

    // First failure is transient - the job must not be marked failed.
    await vi.advanceTimersByTimeAsync(0);
    expect(stateManager.updateJobStatus).not.toHaveBeenCalled();
    expect(emitted.map(([e]) => e)).not.toContain('job:failed');

    // Second exhausts retries - now it is terminal.
    await vi.advanceTimersByTimeAsync(2000);
    expect(stateManager.updateJobStatus).toHaveBeenCalledWith('job-contract', 'failed');
    expect(jobView.hideDownloadLink).toHaveBeenCalledWith('job-contract');
    expect(emitted.map(([e]) => e)).toContain('job:failed');
  });

  it('drives CohortController the same way', async () => {
    const emitted = [];
    const controller = new CohortController({
      eventBus: { on: vi.fn(() => vi.fn()), emit: (e, p) => emitted.push([e, p]) },
      stateManager: { setCohortPolling: vi.fn(), addCohort: vi.fn() },
      apiService: {},
      cohortView: { showCohort: vi.fn(), updateCohort: vi.fn() },
      errorView: { show: vi.fn() },
      pollingManager,
      logger: { logMessage: vi.fn() },
    });

    const pollFn = vi.fn().mockRejectedValue(new Error('network'));
    pollingManager.start('cohort-contract', pollFn, {
      interval: 1000,
      maxRetries: 2,
      onError: (error, context) => controller.handlePollError('cohort-contract', error, context),
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(emitted.map(([e]) => e)).not.toContain('cohort:failed');

    await vi.advanceTimersByTimeAsync(2000);
    expect(emitted.map(([e]) => e)).toContain('cohort:failed');
  });

  it('does not treat a consumer rendering exception as a poll failure', async () => {
    const onError = vi.fn();
    const pollFn = vi.fn().mockResolvedValue({ status: 'completed' });

    pollingManager.start('throwing-consumer', pollFn, {
      interval: 1000,
      maxRetries: 3,
      onComplete: () => {
        throw new Error('view blew up');
      },
      onError,
    });

    await vi.advanceTimersByTimeAsync(0);

    // The view threw, but that is not a transport failure: polling must be
    // finished, not retried against an already-terminal job.
    expect(onError).not.toHaveBeenCalled();
    expect(pollingManager.isActive('throwing-consumer')).toBe(false);

    await vi.advanceTimersByTimeAsync(10000);
    expect(pollFn).toHaveBeenCalledTimes(1);
  });
});
