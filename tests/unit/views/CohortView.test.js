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
    el.innerHTML += '<div class="cohort-status"></div><div class="cohort-job-count"></div>';

    view.updateCohort(id, { status: 'completed', jobCount: 42 });

    expect(el.querySelector('.cohort-status').textContent).toBe('completed');
    expect(el.querySelector('.cohort-status').classList.contains('status-completed')).toBe(true);
    expect(el.querySelector('.cohort-job-count').textContent).toBe('42');
  });
});
