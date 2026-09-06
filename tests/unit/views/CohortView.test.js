import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CohortView } from '../../../resources/js/views/CohortView.js';
import { Cohort } from '../../../resources/js/models/Cohort.js';
import * as uiUtils from '../../../resources/js/uiUtils.js';

vi.mock('../../../resources/js/uiUtils.js', () => ({
  displayShareableLink: vi.fn(),
  hidePlaceholderMessage: vi.fn(),
}));

describe('CohortView', () => {
  let container;
  let view;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'cohortsContainer';
    document.body.appendChild(container);
    view = new CohortView({ container });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('creates and shows a cohort element', () => {
    const id = '123e4567-e89b-42d3-a456-426614174000';
    const cohort = new Cohort({ cohortId: id, status: 'pending', createdAt: Date.now() });
    const el = view.showCohort(cohort);
    expect(el).toBeTruthy();
    expect(el.id).toBe(`cohort-${id}`);
    expect(container.contains(el)).toBe(true);
    expect(uiUtils.hidePlaceholderMessage).toHaveBeenCalled();
  });

  it('calls showShareableLink when options.showShareableLink is true', () => {
    const id = '123e4567-e89b-42d3-a456-426614174001';
    const cohort = new Cohort({ cohortId: id, status: 'pending', createdAt: Date.now() });
    view.showShareableLink = vi.fn();
    view.showCohort(cohort, { showShareableLink: true });
    expect(view.showShareableLink).toHaveBeenCalledWith(id);
  });

  it('updates cohort status and job counts', () => {
    const id = '123e4567-e89b-42d3-a456-426614174002';
    const cohort = new Cohort({ cohortId: id, status: 'pending', createdAt: Date.now() });
    const el = view.showCohort(cohort);

    view.updateCohort(id, { status: 'completed', jobCount: 42 });

    expect(el.querySelector('.cohort-status').textContent).toBe('completed');
    expect(el.querySelector('.cohort-status').classList.contains('status-completed')).toBe(true);
    expect(el.querySelector('.cohort-job-count').textContent).toBe('42');
  });

  it('shows analysis section and triggers onAnalyze callback when clicked', () => {
    const id = '123e4567-e89b-42d3-a456-426614174003';
    const cohort = new Cohort({ cohortId: id, status: 'completed', createdAt: Date.now() });
    const el = view.showCohort(cohort);
    const analysisSection = el.querySelector('.cohort-analysis');
    expect(analysisSection.classList.contains('hidden')).toBe(true);

    const onAnalyze = vi.fn();
    view.showAnalysisSection(id, onAnalyze);

    expect(analysisSection.classList.contains('hidden')).toBe(false);

    const analyzeBtn = el.querySelector('.cohort-analyze-btn');
    expect(analyzeBtn).toBeTruthy();
    analyzeBtn.click();
    expect(onAnalyze).toHaveBeenCalledWith(id);
  });

  it('updates analysis status and button states', () => {
    const id = '123e4567-e89b-42d3-a456-426614174004';
    const cohort = new Cohort({ cohortId: id, status: 'completed', createdAt: Date.now() });
    const el = view.showCohort(cohort);
    view.showAnalysisSection(id);

    const analyzeBtn = el.querySelector('.cohort-analyze-btn');
    const statusEl = el.querySelector('.cohort-analysis-status');

    view.updateAnalysisStatus(id, 'processing', 'Processing samples...');
    expect(statusEl.textContent).toBe('Processing samples...');
    expect(statusEl.classList.contains('status-processing')).toBe(true);
    expect(analyzeBtn.disabled).toBe(true);

    view.updateAnalysisStatus(id, 'failed', 'Analysis run failed');
    expect(statusEl.textContent).toBe('Analysis run failed');
    expect(statusEl.classList.contains('status-failed')).toBe(true);
    expect(analyzeBtn.disabled).toBe(false);
    expect(analyzeBtn.textContent).toBe('Retry Joint Analysis');
  });

  it('renders completed analysis with zip download link', () => {
    const id = '123e4567-e89b-42d3-a456-426614174005';
    const cohort = new Cohort({ cohortId: id, status: 'completed', createdAt: Date.now() });
    const el = view.showCohort(cohort);
    view.showAnalysisSection(id);

    view.updateAnalysisComplete(id, 'analysis-job-999');

    const downloadContainer = el.querySelector('.cohort-analysis-download');
    const downloadLink = downloadContainer.querySelector('.cohort-download-btn');
    expect(downloadLink).toBeTruthy();
    expect(downloadLink.getAttribute('download')).toBe(`cohort_${id}_results.zip`);
    expect(downloadLink.getAttribute('href')).toContain('analysis-job-999');
  });
});
