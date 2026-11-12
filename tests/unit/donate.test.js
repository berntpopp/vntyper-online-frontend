import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDonatePage } from '../../resources/js/donate.js';

describe('donate.js', () => {
  beforeEach(() => {
    window.CONFIG = {
      API_URL: 'http://localhost:8000/api',
      ENABLE_DONATIONS: true,
    };

    document.body.innerHTML = `
      <div id="donationDisabledMsg" class="hidden"></div>
      <div id="donationActiveContainer" class="hidden">
        <input type="checkbox" id="gdprConsent">
        <form id="donationForm">
          <input type="file" id="archiveFile">
          <input type="radio" name="truth" value="confirmed_negative" id="radioNegative" checked>
          <input type="radio" name="truth" value="confirmed_positive" id="radioPositive">
          <input type="radio" name="truth" value="unconfirmed" id="radioUnconfirmed">
          <div id="negativeArmNotice"></div>
          <div id="positiveConfirmationGroup">
            <select id="confirmationSelect"><option value="long_read">Long</option></select>
          </div>
          <button type="submit" id="donateSubmitBtn" disabled>Review</button>
          <span id="donationStatusText"></span>
        </form>
        <section id="donationPreviewSection" class="hidden"><pre id="donationPreview"></pre></section>
        <div id="donationSuccessCard" class="hidden"></div>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('enables review only when consent is checked and a file is selected', () => {
    initDonatePage();

    const consent = document.getElementById('gdprConsent');
    const fileInput = document.getElementById('archiveFile');
    const submitBtn = document.getElementById('donateSubmitBtn');

    expect(submitBtn.disabled).toBe(true);

    consent.checked = true;
    consent.dispatchEvent(new Event('change', { bubbles: true }));
    expect(submitBtn.disabled).toBe(true);

    const file = new File(['zip'], 'results.zip', { type: 'application/zip' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(submitBtn.disabled).toBe(false);
  });

  it('hides the confirmation method for unconfirmed samples', () => {
    initDonatePage();

    const unconfirmed = document.getElementById('radioUnconfirmed');
    const positive = document.getElementById('radioPositive');
    const group = document.getElementById('positiveConfirmationGroup');
    const notice = document.getElementById('negativeArmNotice');

    expect(group.classList.contains('hidden')).toBe(false);
    expect(notice.classList.contains('hidden')).toBe(false);

    unconfirmed.checked = true;
    unconfirmed.dispatchEvent(new Event('change', { bubbles: true }));
    expect(group.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('confirmationSelect').required).toBe(false);

    positive.checked = true;
    positive.dispatchEvent(new Event('change', { bubbles: true }));
    expect(group.classList.contains('hidden')).toBe(false);
    expect(notice.classList.contains('hidden')).toBe(true);
  });

  it('shows disabled message when ENABLE_DONATIONS is false', async () => {
    window.CONFIG.ENABLE_DONATIONS = false;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false }),
    });

    initDonatePage();

    await new Promise(resolve => {
      setTimeout(resolve, 10);
    });

    const activeContainer = document.getElementById('donationActiveContainer');
    const disabledMsg = document.getElementById('donationDisabledMsg');

    expect(activeContainer.classList.contains('hidden')).toBe(true);
    expect(disabledMsg.classList.contains('hidden')).toBe(false);
  });
});
