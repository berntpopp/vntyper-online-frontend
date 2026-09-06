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
      <div id="donationActiveContainer">
        <input type="checkbox" id="gdprConsent">
        <form id="donationForm">
          <input type="file" id="archiveFile">
          <select id="kitSelect"><option value="Twist Exome 2.0">Twist Exome 2.0</option></select>
          <select id="platformSelect"><option value="Illumina NovaSeq 6000">Illumina NovaSeq 6000</option></select>
          <input type="radio" name="finding_call" id="radioNegative" checked>
          <input type="radio" name="finding_call" id="radioPositive">
          <div id="negativeArmNotice"></div>
          <div id="positiveConfirmationGroup" class="hidden">
            <select id="confirmationSelect"><option value="Sanger">Sanger</option></select>
          </div>
          <input type="month" id="collectionMonth" value="2024-05">
          <select id="sexSelect"><option value="XX">XX</option></select>
          <input type="text" id="hpoInput">
          <div id="hpoTags">
            <span class="hpo-tag" data-hpo="HP:0000112">HP:0000112</span>
          </div>
          <button type="submit" id="donateSubmitBtn" disabled>Submit</button>
          <span id="donationStatusText"></span>
        </form>
        <div id="donationSuccessCard" class="hidden">
          <span id="dispDonationId"></span>
          <span id="dispRunId"></span>
        </div>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('enables submit button only when consent is checked and file is selected', () => {
    initDonatePage();

    const consent = document.getElementById('gdprConsent');
    const fileInput = document.getElementById('archiveFile');
    const submitBtn = document.getElementById('donateSubmitBtn');

    expect(submitBtn.disabled).toBe(true);

    consent.checked = true;
    consent.dispatchEvent(new Event('change'));
    expect(submitBtn.disabled).toBe(true);

    // Mock file list
    const file = new File(['fake zip content'], 'results.zip', { type: 'application/zip' });
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: true,
    });
    fileInput.dispatchEvent(new Event('change'));

    expect(submitBtn.disabled).toBe(false);
  });

  it('toggles positive confirmation group and negative notice on radio change', () => {
    initDonatePage();

    const radioNeg = document.getElementById('radioNegative');
    const radioPos = document.getElementById('radioPositive');
    const negNotice = document.getElementById('negativeArmNotice');
    const posGroup = document.getElementById('positiveConfirmationGroup');

    expect(posGroup.classList.contains('hidden')).toBe(true);
    expect(negNotice.classList.contains('hidden')).toBe(false);

    radioPos.checked = true;
    radioPos.dispatchEvent(new Event('change'));

    expect(posGroup.classList.contains('hidden')).toBe(false);
    expect(negNotice.classList.contains('hidden')).toBe(true);

    radioNeg.checked = true;
    radioNeg.dispatchEvent(new Event('change'));

    expect(posGroup.classList.contains('hidden')).toBe(true);
    expect(negNotice.classList.contains('hidden')).toBe(false);
  });

  it('toggles HPO tags into the hpoInput field', () => {
    initDonatePage();

    const tag = document.querySelector('.hpo-tag');
    const input = document.getElementById('hpoInput');

    tag.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(input.value).toBe('HP:0000112');
    expect(tag.classList.contains('active')).toBe(true);

    tag.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(input.value).toBe('');
    expect(tag.classList.contains('active')).toBe(false);
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
