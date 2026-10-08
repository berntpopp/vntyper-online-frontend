// frontend/resources/js/donate.js

import { safeStorage } from './utils/safeStorage.js';
import { t } from './i18n.js';

/**
 * Initializes the Data Donation page, handling consent, form validation,
 * controlled vocabularies, and submission to the backend API.
 */
export function initDonatePage() {
  const donationActiveContainer = document.getElementById('donationActiveContainer');
  const donationDisabledMsg = document.getElementById('donationDisabledMsg');
  const donationForm = /** @type {HTMLFormElement | null} */ (
    document.getElementById('donationForm')
  );
  const gdprConsent = /** @type {HTMLInputElement | null} */ (
    document.getElementById('gdprConsent')
  );
  const archiveFileInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById('archiveFile')
  );
  const submitBtn = /** @type {HTMLButtonElement | null} */ (
    document.getElementById('donateSubmitBtn')
  );
  const statusText = document.getElementById('donationStatusText');
  const radioNegative = /** @type {HTMLInputElement | null} */ (
    document.getElementById('radioNegative')
  );
  const radioPositive = /** @type {HTMLInputElement | null} */ (
    document.getElementById('radioPositive')
  );
  const negativeArmNotice = document.getElementById('negativeArmNotice');
  const positiveConfirmationGroup = document.getElementById('positiveConfirmationGroup');
  const confirmationSelect = /** @type {HTMLSelectElement | null} */ (
    document.getElementById('confirmationSelect')
  );
  const hpoInput = /** @type {HTMLInputElement | null} */ (document.getElementById('hpoInput'));
  const hpoTagsContainer = document.getElementById('hpoTags');
  const donationSuccessCard = document.getElementById('donationSuccessCard');
  const dispDonationId = document.getElementById('dispDonationId');
  const dispRunId = document.getElementById('dispRunId');

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

  // 2. Positive vs Negative finding toggle
  function updateFindingUI() {
    const isPositive = radioPositive?.checked;
    if (isPositive) {
      positiveConfirmationGroup?.classList.remove('hidden');
      negativeArmNotice?.classList.add('hidden');
      if (confirmationSelect) confirmationSelect.required = true;
    } else {
      positiveConfirmationGroup?.classList.add('hidden');
      negativeArmNotice?.classList.remove('hidden');
      if (confirmationSelect) {
        confirmationSelect.required = false;
        confirmationSelect.value = '';
      }
    }
  }

  radioNegative?.addEventListener('change', updateFindingUI);
  radioPositive?.addEventListener('change', updateFindingUI);

  // 3. HPO tag helper
  if (hpoTagsContainer && hpoInput) {
    hpoTagsContainer.addEventListener('click', e => {
      const target = /** @type {HTMLElement | null} */ (e.target);
      if (target && target.classList.contains('hpo-tag')) {
        const hpoCode = target.getAttribute('data-hpo');
        if (!hpoCode) return;

        let currentTerms = hpoInput.value
          .split(',')
          .map(t => t.trim().toUpperCase())
          .filter(Boolean);

        if (currentTerms.includes(hpoCode)) {
          currentTerms = currentTerms.filter(t => t !== hpoCode);
          target.classList.remove('active');
        } else {
          currentTerms.push(hpoCode);
          target.classList.add('active');
        }
        hpoInput.value = currentTerms.join(', ');
      }
    });
  }

  // 4. Form validation & submit enabling
  function validateFormState() {
    const hasConsent = Boolean(gdprConsent?.checked);
    const hasFile = Boolean(archiveFileInput?.files && archiveFileInput.files.length > 0);
    if (submitBtn) {
      submitBtn.disabled = !(hasConsent && hasFile);
    }
  }

  gdprConsent?.addEventListener('change', validateFormState);
  archiveFileInput?.addEventListener('change', validateFormState);

  // 5. Submit Handler
  donationForm.addEventListener('submit', async e => {
    e.preventDefault();

    if (!gdprConsent?.checked) {
      alert(t('GDPR explicit consent is required to donate data.'));
      return;
    }

    const file = archiveFileInput?.files?.[0];
    if (!file) {
      alert(t('Please select a result ZIP archive to donate.'));
      return;
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert(t('Please select a valid .zip result file.'));
      return;
    }

    const kitSelect = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('kitSelect')
    );
    const platformSelect = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('platformSelect')
    );
    const sexSelect = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('sexSelect')
    );
    const collectionMonthInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById('collectionMonth')
    );

    const isPositive = Boolean(radioPositive?.checked);
    const confirmationMethod = isPositive ? confirmationSelect?.value : null;

    if (isPositive && (!confirmationMethod || !confirmationMethod.trim())) {
      alert(t('Confirmation method is required for positive findings.'));
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (statusText) {
      statusText.textContent = t('Verifying and uploading donation...');
      statusText.style.color = '#005f73';
    }

    const formData = new FormData();
    formData.append('archive', file);
    formData.append('consent', 'true');
    formData.append('kit', kitSelect?.value || '');
    formData.append('sequencing_platform', platformSelect?.value || '');
    formData.append('positive_call', isPositive ? 'true' : 'false');
    if (confirmationMethod) {
      formData.append('confirmation_method', confirmationMethod);
    }
    if (hpoInput?.value.trim()) {
      formData.append('phenotype_hpo', hpoInput.value.trim());
    }
    if (sexSelect?.value) {
      formData.append('sex', sexSelect.value);
    }
    if (collectionMonthInput?.value) {
      formData.append('collection_month', collectionMonthInput.value);
    }

    try {
      const res = await fetch(`${apiUrl}/donations/`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.detail ||
            t('Server responded with {status}: {statusText}', {
              status: res.status,
              statusText: res.statusText,
            })
        );
      }

      const responseData = await res.json();
      donationForm.classList.add('hidden');
      if (donationSuccessCard) {
        donationSuccessCard.classList.remove('hidden');
        if (dispDonationId) dispDonationId.textContent = responseData.donation_id;
        if (dispRunId) dispRunId.textContent = responseData.run_id;
      }
    } catch (err) {
      if (statusText) {
        statusText.textContent = t('Error: {message}', { message: err.message });
        statusText.style.color = '#c0392b';
      }
      if (submitBtn) submitBtn.disabled = false;
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
