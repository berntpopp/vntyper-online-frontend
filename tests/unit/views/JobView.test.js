// tests/unit/views/JobView.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// uiUtils touches DOM the view does not own; stub it out.
vi.mock('../../../resources/js/uiUtils.js', () => ({
  displayShareableLink: vi.fn(),
  hidePlaceholderMessage: vi.fn(),
}));

import { JobView } from '../../../resources/js/views/JobView.js';

/**
 * Minimal Job test double.
 * _createJobElement() calls job.isActive(), so a plain object is not enough.
 */
function makeJob(overrides = {}) {
  return {
    jobId: 'job-1',
    status: 'processing',
    fileName: 'sample.bam',
    isActive: () => true,
    ...overrides,
  };
}

describe('JobView.hideDownloadLink()', () => {
  let view;
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="jobOutput"></div>';
    container = document.getElementById('jobOutput');
    window.CONFIG = { API_URL: '/api' };
    view = new JobView({ container });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.CONFIG;
    vi.clearAllMocks();
  });

  it('removes a rendered download link and re-hides its container', () => {
    view.showJob(makeJob());
    view.showDownloadLink('job-1');

    expect(document.getElementById('download-job-1')).not.toBeNull();
    expect(container.querySelector('.job-download').classList.contains('hidden')).toBe(false);

    view.hideDownloadLink('job-1');

    expect(document.getElementById('download-job-1')).toBeNull();
    expect(container.querySelector('.job-download').classList.contains('hidden')).toBe(true);
  });

  it('is a no-op when no download link was ever shown', () => {
    view.showJob(makeJob());

    expect(() => view.hideDownloadLink('job-1')).not.toThrow();
    expect(container.querySelector('.job-download').classList.contains('hidden')).toBe(true);
  });

  it('is a no-op for an unknown job id', () => {
    expect(() => view.hideDownloadLink('does-not-exist')).not.toThrow();
  });
});
