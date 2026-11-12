import { test, expect } from '@playwright/test';
import { mockApi, collectPageErrors } from './fixtures/api.js';
import { makeZip } from './fixtures/zip.js';

const CONTRACT_KEYS = [
  'array_depth_bin',
  'confirmation_class',
  'coverage_qc',
  'depth_score_bin',
  'flank_depth_bin',
  'kestrel_call',
  'kestrel_confidence',
  'kestrel_flagged',
  'kit',
  'platform_class',
  'referral',
  'schema',
  'truth',
  'variant_class',
  'vntyper_version',
];

test('donation sends only the reviewed JSON record, never a file', async ({ page }) => {
  const errors = collectPageErrors(page);
  await mockApi(page, { '/donations/status/': { enabled: true } });

  /** @type {import('@playwright/test').Request[]} */
  const posts = [];
  await page.route('http://localhost:8000/api/donations/', async route => {
    posts.push(route.request());
    await route.fulfill({ status: 201, json: { status: 'recorded' } });
  });

  await page.goto('/donate.html');

  const zip = await makeZip(
    {
      'pipeline_summary.json': '{"sample_name":"PATIENT-SECRET-42"}',
      'coverage/coverage_summary.tsv':
        'vntr_array_depth_sum_per_unit_length\tvntr_flank_mean_depth\tcoverage_qc\n210.6\t164.5\tPASS\n',
      'kestrel/kestrel_result.tsv':
        '## VNtyper Version: 2.0.49\nSample\tDepth_Score\tConfidence\tFlag\tNomenclature\n' +
        'PATIENT-SECRET-42\t0.0177\tHigh_Precision*\tNot flagged\t59dupC\n',
    },
    true
  );
  await page.locator('#archiveFile').setInputFiles({
    name: 'results_PATIENT-SECRET-42.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(zip),
  });
  await page.locator('#kitSelect').selectOption('Twist Exome 2.0');
  await page.locator('#platformSelect').selectOption('illumina_short');
  await page.locator('#radioPositive').check();
  await page.locator('#confirmationSelect').selectOption('long_read');
  await page.locator('#referralSelect').selectOption('suspected_adtkd');
  await page.locator('#gdprConsent').check();

  await page.locator('#donateSubmitBtn').click();
  const preview = page.locator('#donationPreview');
  await expect(preview).toBeVisible();
  const shown = JSON.parse(await preview.textContent());
  expect(posts).toHaveLength(0);

  await page.locator('#donateSendBtn').click();
  await expect(page.locator('#donationSuccessCard')).toBeVisible();

  expect(posts).toHaveLength(1);
  const req = posts[0];
  expect(req.method()).toBe('POST');
  expect(req.headers()['content-type']).toBe('application/json');
  const raw = req.postData();
  expect(raw).not.toMatch(/PATIENT|multipart|Content-Disposition|filename/);
  const body = JSON.parse(raw);
  expect(Object.keys(body).sort()).toEqual(CONTRACT_KEYS);
  expect(body).toEqual(shown);
  expect(body).toMatchObject({
    schema: 'vntyper-donation/2',
    vntyper_version: '2.0.49',
    kestrel_call: true,
    variant_class: 'dupC',
    truth: 'confirmed_positive',
    confirmation_class: 'long_read',
  });
  // The thank-you shows no identifier.
  await expect(page.locator('#donationSuccessCard')).not.toContainText(/ID/);
  expect(errors).toEqual([]);
});

test('disabled backend keeps the Data Donation Inactive state', async ({ page }) => {
  await mockApi(page);
  await page.goto('/donate.html');
  await expect(page.locator('#donationDisabledMsg')).toBeVisible();
  await expect(page.locator('#donationActiveContainer')).toBeHidden();
});
