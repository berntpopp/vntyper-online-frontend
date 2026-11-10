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

describe('JobView.showSummary()', () => {
  let view;
  let container;
  const coverageStep = qc => ({
    step: 'Coverage Calculation',
    parsed_result: { data: [{ mean: '208', coverage_qc: qc }] },
  });

  beforeEach(() => {
    document.body.innerHTML = '<div id="jobOutput"></div>';
    container = document.getElementById('jobOutput');
    window.CONFIG = { API_URL: '/api' };
    view = new JobView({ container });
    view.showJob(makeJob());
    view.showDownloadLink('job-1');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.CONFIG;
  });

  const panelText = () => container.querySelector('.job-summary')?.textContent ?? null;

  it('renders coverage QC, confidence, subthreshold and long-array note', () => {
    view.showSummary('job-1', {
      steps: [{ step: 'Kestrel Genotyping' }, coverageStep('REDUCED')],
      confidence_grade: 'no-finding-limited',
      subthreshold_signal: { state: 'negative_subthreshold', best_depth_score: 0.003123 },
      length_sensitivity_tier: 'high',
      length_sensitivity_policy: { high_threshold: 150 },
    });

    const text = panelText();
    expect(text).toContain('Coverage QC: Reduced');
    expect(text).toContain('Confidence: No finding, inconclusive');
    expect(text).toContain('best depth score 0.00312');
    expect(text).toContain('It is not a call.');
    expect(text).toContain('over 150 repeats');
    expect(text).toContain('A negative result does not exclude ADTKD-MUC1');
    expect(text).toContain('never count as positive');
    // Sits right after the download link.
    expect(container.querySelector('.job-download').nextElementSibling.className).toBe(
      'job-summary'
    );
  });

  it('shows only the fields an older summary has', () => {
    view.showSummary('job-1', {
      steps: [coverageStep('PASS')],
      subthreshold_signal: { state: 'none', best_depth_score: null },
      length_sensitivity_tier: 'below',
    });

    const text = panelText();
    expect(text).toContain('Coverage QC: Pass');
    expect(text).not.toContain('Confidence:');
    expect(text).not.toContain('reporting threshold');
    expect(text).not.toContain('repeats');
  });

  it('renders nothing for a null summary (404) or one without QC fields', () => {
    view.showSummary('job-1', null);
    expect(panelText()).toBeNull();
    view.showSummary('job-1', { version: '2.0.47' });
    expect(panelText()).toBeNull();
    view.showSummary('job-1', { steps: 'garbage' });
    expect(panelText()).toBeNull();
  });

  it('falls back to the raw token for an unknown grade and does not duplicate', () => {
    view.showSummary('job-1', { confidence_grade: 'future-grade' });
    view.showSummary('job-1', { confidence_grade: 'future-grade' });
    expect(container.querySelectorAll('.job-summary')).toHaveLength(1);
    expect(panelText()).toContain('Confidence: future-grade');
  });
});
