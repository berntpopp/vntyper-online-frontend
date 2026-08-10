// tests/unit/controllers/AppController.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../resources/js/uiUtils.js', () => ({
  showSpinner: vi.fn(),
  hideSpinner: vi.fn(),
  createSpinnerHTML: vi.fn(() => '<span class="spinner"></span>'),
  createAssemblyMessageHTML: vi.fn(() => ''),
  ensureSpinAnimation: vi.fn(),
  startCountdown: vi.fn(),
  clearCountdown: vi.fn(),
  displayShareableLink: vi.fn(),
  hidePlaceholderMessage: vi.fn(),
}));

vi.mock('../../../resources/js/errorHandling.js', () => ({
  errorHandler: {
    registerGlobalHandlers: vi.fn(),
    handleError: vi.fn(),
  },
  displayError: vi.fn(),
  clearError: vi.fn(),
  clearMessage: vi.fn(),
  displayMessage: vi.fn(),
}));

vi.mock('../../../resources/js/blobManager.js', () => ({
  blobManager: {
    create: vi.fn(() => 'blob:mock'),
    revoke: vi.fn(() => true),
    revokeMultiple: vi.fn(urls => urls.length),
    revokeAll: vi.fn(() => 0),
  },
}));

import { blobManager } from '../../../resources/js/blobManager.js';
import { AppController } from '../../../resources/js/controllers/AppController.js';

/**
 * BaseController's constructor calls initialize() -> initializeEventListeners(),
 * which caches the button elements. The DOM must therefore exist BEFORE
 * construction, which is exactly the ordering this suite pins down.
 */
function buildDom() {
  document.body.innerHTML = `
    <button id="submitBtn">Submit Jobs</button>
    <button id="extractBtn">Extract Region</button>
    <button id="resetFileSelectionBtn">Reset</button>
    <div id="placeholderMessage"></div>
    <div id="regionOutput"></div>
    <div id="jobOutput"></div>
    <div id="error"></div>
    <select id="region"><option value="guess">Guess assembly</option></select>
  `;
}

function buildDependencies() {
  const stubController = {
    handleSubmit: vi.fn(),
    handleValidation: vi.fn(async () => ({ matchedPairs: [] })),
    handleExtract: vi.fn(),
    handlePoll: vi.fn(),
    handleClear: vi.fn(),
  };

  return {
    eventBus: { on: vi.fn(() => vi.fn()), emit: vi.fn(), emitAsync: vi.fn() },
    stateManager: { reset: vi.fn(), getJobs: vi.fn(() => []) },
    logger: { logMessage: vi.fn() },
    jobController: { ...stubController, jobView: { clearAll: vi.fn() } },
    cohortController: { ...stubController, cohortView: { clearAll: vi.fn() } },
    fileController: { ...stubController, selectedFiles: [] },
    extractionController: { ...stubController },
    errorView: { show: vi.fn(), clear: vi.fn() },
  };
}

describe('AppController button references', () => {
  let deps;

  beforeEach(() => {
    buildDom();
    deps = buildDependencies();
    window.CONFIG = { API_URL: '/api' };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.CONFIG;
    vi.clearAllMocks();
  });

  it('keeps the cached submit button after construction', () => {
    const app = new AppController(deps);

    expect(app.submitBtn).toBe(document.getElementById('submitBtn'));
  });

  it('keeps the cached extract button after construction', () => {
    const app = new AppController(deps);

    expect(app.extractBtn).toBe(document.getElementById('extractBtn'));
  });

  it('keeps the cached reset button after construction', () => {
    const app = new AppController(deps);

    // Note the DOM id is resetFileSelectionBtn, not resetBtn.
    expect(app.resetBtn).toBe(document.getElementById('resetFileSelectionBtn'));
  });

  it('can actually disable the submit button through the cached reference', () => {
    const app = new AppController(deps);

    // This is what every `if (this.submitBtn)` guard in the controller does.
    // Before the fix the reference was null and the guard silently no-opped.
    expect(app.submitBtn).not.toBeNull();
    app.submitBtn.disabled = true;

    expect(document.getElementById('submitBtn').disabled).toBe(true);
  });
});

describe('AppController Blob URL lifetime', () => {
  let deps;

  beforeEach(() => {
    buildDom();
    deps = buildDependencies();
    window.CONFIG = { API_URL: '/api' };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.CONFIG;
    vi.clearAllMocks();
  });

  it('revokes the URLs it orphans when the result pane is replaced', () => {
    const app = new AppController(deps);
    app._renderedResultUrls = ['blob:a', 'blob:b'];

    app._replaceRegionOutput('<p>next result</p>');

    expect(blobManager.revokeMultiple).toHaveBeenCalledWith(['blob:a', 'blob:b']);
    expect(app._renderedResultUrls).toEqual([]);
    expect(document.getElementById('regionOutput').innerHTML).toBe('<p>next result</p>');
  });

  it('does not call revokeMultiple when nothing is rendered', () => {
    const app = new AppController(deps);

    app._replaceRegionOutput();

    expect(blobManager.revokeMultiple).not.toHaveBeenCalled();
  });

  it('revokes everything on reset', () => {
    const app = new AppController(deps);
    app._renderedResultUrls = ['blob:a'];

    app.handleReset();

    expect(blobManager.revokeAll).toHaveBeenCalled();
    expect(app._renderedResultUrls).toEqual([]);
  });
});
