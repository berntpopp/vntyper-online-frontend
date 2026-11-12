// frontend/resources/js/donate.js

import { safeStorage } from './utils/safeStorage.js';
import { readZipMembers, buildDonation, NO_DEPTH_SCORE } from './utils/donationPayload.js';
import { t } from './i18n.js';

/**
 * Initializes the Data Donation page: the result ZIP is reduced in the browser
 * to a small binned record, shown to the donor, and only that JSON is sent.
 * @returns {void}
 */
export function initDonatePage() {
  const $ = (/** @type {string} */ id) => /** @type {any} */ (document.getElementById(id));
  const donationActiveContainer = $('donationActiveContainer');
  const donationDisabledMsg = $('donationDisabledMsg');
  const donationForm = /** @type {HTMLFormElement | null} */ ($('donationForm'));
  const gdprConsent = /** @type {HTMLInputElement | null} */ ($('gdprConsent'));
  const archiveFileInput = /** @type {HTMLInputElement | null} */ ($('archiveFile'));
  const submitBtn = /** @type {HTMLButtonElement | null} */ ($('donateSubmitBtn'));
  const sendBtn = /** @type {HTMLButtonElement | null} */ ($('donateSendBtn'));
  const statusText = $('donationStatusText');
  const radioNegative = /** @type {HTMLInputElement | null} */ ($('radioNegative'));
  const negativeArmNotice = $('negativeArmNotice');
  const confirmationGroup = $('positiveConfirmationGroup');
  const confirmationSelect = /** @type {HTMLSelectElement | null} */ ($('confirmationSelect'));
  const previewSection = $('donationPreviewSection');
  const preview = $('donationPreview');
  const donationSuccessCard = $('donationSuccessCard');

  if (!donationForm) return;

  // 1. Feature Flag check
  const apiUrl = window.CONFIG?.API_URL || '/api';
  const isEnabledConfig = Boolean(window.CONFIG?.ENABLE_DONATIONS);

  async function checkServerStatus() {
    try {
      const res = await fetch(`${apiUrl}/donations/status/`);
      if (res.ok) {
        const data = await res.json();
        return Boolean(data.enabled);
      }
    } catch {
      // Unreachable API: treat as disabled.
    }
    return false;
  }

  // Both panels start hidden so the form never flashes before being replaced.
  if (isEnabledConfig) {
    donationActiveContainer?.classList.remove('hidden');
  } else {
    // Paint the last known state at once (a reload restores scroll, and a late
    // panel would shift the footer), then correct it if the server disagrees.
    const showPanel = (/** @type {boolean} */ enabled) => {
      donationActiveContainer?.classList.toggle('hidden', !enabled);
      donationDisabledMsg?.classList.toggle('hidden', enabled);
    };
    const known = safeStorage.getItem('donationsEnabled');
    if (known !== null) showPanel(known === 'true');
    checkServerStatus().then(enabled => {
      showPanel(enabled);
      safeStorage.setItem('donationsEnabled', String(enabled));
    });
  }

  /** @type {Record<string, string | boolean | null> | null} */
  let payload = null;

  /** @param {string} message @param {string} [color] */
  function setStatus(message, color = '#475569') {
    if (statusText) {
      statusText.textContent = message;
      statusText.style.color = color;
    }
  }

  // 2. Any change invalidates a shown record and re-evaluates the controls.
  function updateFormState() {
    const truth = donationForm.elements.namedItem('truth');
    const unconfirmed = /** @type {RadioNodeList} */ (truth)?.value === 'unconfirmed';
    confirmationGroup?.classList.toggle('hidden', unconfirmed);
    if (confirmationSelect) {
      confirmationSelect.required = !unconfirmed;
      if (unconfirmed) confirmationSelect.value = '';
    }
    negativeArmNotice?.classList.toggle('hidden', !radioNegative?.checked);

    payload = null;
    previewSection?.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = !(gdprConsent?.checked && archiveFileInput?.files?.length);
    }
  }

  gdprConsent?.addEventListener('change', updateFormState);
  donationForm.addEventListener('change', updateFormState);
  updateFormState();

  // 3. Review: read the ZIP locally and show the exact record.
  donationForm.addEventListener('submit', async e => {
    e.preventDefault();
    const file = archiveFileInput?.files?.[0];
    if (!gdprConsent?.checked || !file) return;

    const field = (/** @type {string} */ id) => /** @type {HTMLSelectElement} */ ($(id))?.value;
    const truth = /** @type {RadioNodeList} */ (donationForm.elements.namedItem('truth')).value;
    try {
      const members = await readZipMembers(file);
      payload = buildDonation(members, {
        kit: field('kitSelect'),
        platform_class: field('platformSelect'),
        truth,
        confirmation_class: truth === 'unconfirmed' ? 'none' : field('confirmationSelect'),
        referral: field('referralSelect') || undefined,
      });
    } catch (err) {
      const reason =
        err.message === NO_DEPTH_SCORE
          ? t(
              'The VNtyper call in this result has no readable depth score, so it cannot be donated.'
            )
          : `${t('This file could not be read as a VNtyper result ZIP.')} (${err.message})`;
      setStatus(reason, '#c0392b');
      return;
    }
    if (preview) preview.textContent = JSON.stringify(payload, null, 2);
    previewSection?.classList.remove('hidden');
    if (sendBtn) sendBtn.disabled = false;
    setStatus('');
    previewSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // 4. Send: only the record shown above, as JSON.
  sendBtn?.addEventListener('click', async () => {
    if (!payload || !gdprConsent?.checked) return;
    sendBtn.disabled = true;
    setStatus(t('Sending donation...'), '#005f73');
    try {
      const res = await fetch(`${apiUrl}/donations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(
          t('Server responded with {status}: {statusText}', {
            status: res.status,
            statusText: res.statusText,
          })
        );
      }
      donationForm.classList.add('hidden');
      previewSection?.classList.add('hidden');
      document.querySelector('.consent-banner')?.classList.add('hidden');
      donationSuccessCard?.classList.remove('hidden');
    } catch (err) {
      setStatus(t('Error: {message}', { message: err.message }), '#c0392b');
      sendBtn.disabled = false;
    }
  });
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDonatePage);
  } else {
    initDonatePage();
  }
}
