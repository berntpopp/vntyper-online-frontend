import { test, expect } from '@playwright/test';
import { mockApi, acknowledgeDisclaimer, collectPageErrors } from './fixtures/api.js';

test.describe('monkey and exploratory testing', () => {
  test('rapid UI interactions, tabs, modals and rapid input do not produce console or page errors', async ({
    page,
    isMobile,
  }) => {
    const errors = collectPageErrors(page);

    await acknowledgeDisclaimer(page);
    await mockApi(page);
    await page.goto('/');

    // 1. Rapidly toggle log panel
    const logToggle = page.locator('#toggleLogBtn');
    for (let i = 0; i < 5; i++) {
      await logToggle.click({ force: true });
    }

    // 2. Open and close FAQ modal if on desktop
    if (!isMobile) {
      const faqLink = page.locator('a[data-modal="faqModal"]');
      if (await faqLink.isVisible()) {
        await faqLink.click();
        await page.keyboard.press('Escape');
      }
    }

    // 3. Fuzz inputs in analysis configuration
    const cohortCheckbox = page.locator('#cohortMode');
    if (await cohortCheckbox.isVisible()) {
      await cohortCheckbox.check();
      const aliasInput = page.locator('#cohortAlias');
      if (await aliasInput.isVisible()) {
        await aliasInput.fill('!@#$%^&*()_+=~`{}[]|:;"<>,.?/');
        await aliasInput.fill('a'.repeat(200));
        await aliasInput.clear();
      }
      const passphraseInput = page.locator('#passphrase');
      if (await passphraseInput.isVisible()) {
        await passphraseInput.fill('unicode-日本語-🚀-test');
        await passphraseInput.clear();
      }
      await cohortCheckbox.uncheck();
    }

    // 4. Region dropdown toggling
    const regionSelect = page.locator('#region');
    if (await regionSelect.isVisible()) {
      const options = await regionSelect.locator('option').all();
      for (let i = 0; i < Math.min(options.length, 4); i++) {
        const val = await options[i].getAttribute('value');
        if (val) {
          await regionSelect.selectOption(val);
        }
      }
    }

    // Verify zero uncaught errors
    expect(errors, `Uncaught page errors during monkey testing: ${errors.join('; ')}`).toEqual([]);
  });

  test('donate page interactive state transitions without runtime errors', async ({ page }) => {
    const errors = collectPageErrors(page);

    await mockApi(page, {
      '/donations/status/': { enabled: true },
    });
    await page.goto('/donate.html');

    // 1. Toggle positive / negative arms
    const radioPos = page.locator('#radioPositive');
    const radioNeg = page.locator('#radioNegative');
    const confirmationGroup = page.locator('#positiveConfirmationGroup');
    const negativeNotice = page.locator('#negativeArmNotice');

    await radioPos.check();
    await expect(confirmationGroup).toBeVisible();
    await expect(negativeNotice).toBeHidden();

    await radioNeg.check();
    await expect(confirmationGroup).toBeHidden();
    await expect(negativeNotice).toBeVisible();

    // 2. Rapidly toggle HPO tags
    const hpoTags = page.locator('#hpoTags .hpo-tag');
    const count = await hpoTags.count();
    for (let i = 0; i < Math.min(count, 4); i++) {
      await hpoTags.nth(i).click();
    }
    const hpoInput = page.locator('#hpoInput');
    const val = await hpoInput.inputValue();
    expect(val.length).toBeGreaterThan(0);

    // Toggle off
    for (let i = 0; i < Math.min(count, 4); i++) {
      await hpoTags.nth(i).click();
    }
    expect(await hpoInput.inputValue()).toBe('');

    // 3. Submit button disabled state
    const submitBtn = page.locator('#donateSubmitBtn');
    await expect(submitBtn).toBeDisabled();

    // Consent checkbox alone should not enable submit button (requires archive too)
    const consent = page.locator('#gdprConsent');
    await consent.check();
    await expect(submitBtn).toBeDisabled();

    expect(errors, `Uncaught page errors on /donate.html: ${errors.join('; ')}`).toEqual([]);
  });

  test('monkey testing file wrangling, validation, and cohort workflows with real BAM and BAI files from VNtyper repo', async ({
    page,
  }) => {
    const errors = collectPageErrors(page);

    await acknowledgeDisclaimer(page);
    await mockApi(page);
    await page.goto('/');

    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const dataDir = path.resolve(__dirname, '../../../backend/tests/data');

    const realBams = {
      hg38_40cf: {
        bam: path.join(dataDir, 'example_40cf_hg38_subset.bam'),
        bai: path.join(dataDir, 'example_40cf_hg38_subset.bam.bai'),
      },
      hg19_66bf: {
        bam: path.join(dataDir, 'example_66bf_hg19_subset.bam'),
        bai: path.join(dataDir, 'example_66bf_hg19_subset.bam.bai'),
      },
      hg19_b178: {
        bam: path.join(dataDir, 'example_b178_hg19_subset.bam'),
        bai: path.join(dataDir, 'example_b178_hg19_subset.bam.bai'),
      },
      unsupported: path.join(dataDir, 'README.md'),
    };

    const fileInput = page.locator('#bamFiles');
    const fileList = page.locator('#fileList');
    const errorContainer = page.locator('#error');

    // 1. Monkey test: Invalid combinations with real BAM files
    // Lonely BAM (missing BAI)
    await fileInput.setInputFiles([realBams.hg38_40cf.bam]);
    await expect(errorContainer).toBeVisible();
    await expect(errorContainer).toContainText(/invalid/i);
    await expect(errorContainer).toContainText('example_40cf_hg38_subset.bam');
    await expect(fileList).toContainText(/no files selected/i);

    // Lonely BAI (missing BAM)
    await fileInput.setInputFiles([realBams.hg38_40cf.bai]);
    await expect(errorContainer).toBeVisible();
    await expect(errorContainer).toContainText(/invalid/i);
    await expect(errorContainer).toContainText('example_40cf_hg38_subset.bam.bai');

    // Mismatched BAM & BAI from different real samples
    await fileInput.setInputFiles([realBams.hg38_40cf.bam, realBams.hg19_66bf.bai]);
    await expect(errorContainer).toBeVisible();
    await expect(errorContainer).toContainText(/invalid/i);

    // 2. Monkey test: Valid real BAM pair
    await fileInput.setInputFiles([realBams.hg38_40cf.bam, realBams.hg38_40cf.bai]);
    await expect(fileList).toContainText('example_40cf_hg38_subset.bam');
    await expect(errorContainer).toBeEmpty();

    // 3. Monkey test: Valid pair + unsupported file (mixed)
    await fileInput.setInputFiles([
      realBams.hg38_40cf.bam,
      realBams.hg38_40cf.bai,
      realBams.unsupported,
    ]);
    await expect(errorContainer).toBeVisible();
    await expect(errorContainer).toContainText(/invalid/i);
    await expect(errorContainer).toContainText('README.md');
    // Even with the warning, the valid pair is matched
    await expect(fileList).toContainText('example_40cf_hg38_subset.bam');

    // 4. Monkey test: Multi-sample real BAM cohort (all 3 distinct pairs from VNtyper test data)
    await fileInput.setInputFiles([
      realBams.hg38_40cf.bam,
      realBams.hg38_40cf.bai,
      realBams.hg19_66bf.bam,
      realBams.hg19_66bf.bai,
      realBams.hg19_b178.bam,
      realBams.hg19_b178.bai,
    ]);
    await expect(fileList).toContainText('example_40cf_hg38_subset.bam');
    await expect(fileList).toContainText('example_66bf_hg19_subset.bam');
    await expect(fileList).toContainText('example_b178_hg19_subset.bam');

    // 5. Monkey test: Rapid fuzzing and state transitions with multi-sample real BAMs loaded
    const toggleOptions = page.locator('#toggleOptionalInputs');
    if (await toggleOptions.isVisible()) {
      await toggleOptions.click();
    }

    const aliasInput = page.locator('#cohortAlias');
    if (await aliasInput.isVisible()) {
      await aliasInput.fill('Real-BAM-Cohort-Test');
      await aliasInput.fill('!@#$%^&*()_+=~`{}[]|:;"<>,.?/ 🔥');
      await aliasInput.fill('A'.repeat(128));
      await aliasInput.fill('Validated-Cohort-Real-BAM');
    }

    const passphraseInput = page.locator('#passphrase');
    if (await passphraseInput.isVisible()) {
      await passphraseInput.fill('Pass!@#123_日本語_🚀');
    }

    // Toggle secondary algorithms
    const advntrCheckbox = page.locator('#advntrMode');
    if (await advntrCheckbox.isVisible()) {
      await advntrCheckbox.check();
      await advntrCheckbox.uncheck();
      await advntrCheckbox.check();
    }

    // Toggle regions
    const regionSelect = page.locator('#region');
    if (await regionSelect.isVisible()) {
      const options = await regionSelect.locator('option').all();
      for (let i = 0; i < Math.min(options.length, 3); i++) {
        const val = await options[i].getAttribute('value');
        if (val) {
          await regionSelect.selectOption(val);
        }
      }
    }

    // Rapidly toggle log drawer while real BAMs are present
    const logToggle = page.locator('#toggleLogBtn');
    for (let i = 0; i < 4; i++) {
      await logToggle.click({ force: true });
    }

    // Verify zero uncaught errors occurred throughout the real BAM monkey testing
    expect(
      errors,
      `Uncaught page errors during real BAM monkey testing: ${errors.join('; ')}`
    ).toEqual([]);
  });

  test('real BAM cohort creation, multi-sample submission, and joint analysis workflow', async ({
    page,
  }) => {
    const errors = collectPageErrors(page);

    const cohortId = 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d';
    const analysisJobId = 'analysis-job-real-777';

    await acknowledgeDisclaimer(page);
    await mockApi(page, {
      '/create-cohort/': { cohort_id: cohortId, alias: 'Monkey-Cohort' },
      '/run-job/': { message: 'Job submitted', job_id: 'job-real-1' },
      '/cohort-status/': {
        cohort_id: cohortId,
        alias: 'Monkey-Cohort',
        jobs: ['job-real-1', 'job-real-2'],
        status: 'completed',
      },
      '/job-status/': { status: 'completed' },
      '/cohort-analysis/': {
        message: 'Cohort analysis submitted',
        analysis_job_id: analysisJobId,
      },
      [`/job-status/${analysisJobId}/`]: { status: 'completed' },
    });

    await page.goto('/');

    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const dataDir = path.resolve(__dirname, '../../../backend/tests/data');

    // 1. Upload real BAM and BAI pairs
    await page
      .locator('#bamFiles')
      .setInputFiles([
        path.join(dataDir, 'example_40cf_hg38_subset.bam'),
        path.join(dataDir, 'example_40cf_hg38_subset.bam.bai'),
        path.join(dataDir, 'example_66bf_hg19_subset.bam'),
        path.join(dataDir, 'example_66bf_hg19_subset.bam.bai'),
      ]);

    await expect(page.locator('#fileList')).toContainText('example_40cf_hg38_subset.bam');
    await expect(page.locator('#fileList')).toContainText('example_66bf_hg19_subset.bam');

    // 2. Configure cohort
    const toggleOptionsBtn = page.locator('#toggleOptionalInputs');
    if (await toggleOptionsBtn.isVisible()) {
      await toggleOptionsBtn.click();
    }
    await page.locator('#cohortAlias').fill('Monkey-Cohort');
    await page.locator('#passphrase').fill('secure-cohort-passphrase');

    // 3. Trigger cohort creation and analysis workflow via controller events in page context
    await page.evaluate(
      async ({ cid }) => {
        const cohortCtrl = window.__controllers?.cohort;
        if (cohortCtrl) {
          // Create cohort in controller
          await cohortCtrl.handleCreate({
            alias: 'Monkey-Cohort',
            passphrase: 'secure-cohort-passphrase',
          });

          // Simulate jobs submitted to cohort and tracked in state
          cohortCtrl.stateManager.addJob('job-real-1', {
            jobId: 'job-real-1',
            cohortId: cid,
            status: 'completed',
          });
          cohortCtrl.stateManager.addJob('job-real-2', {
            jobId: 'job-real-2',
            cohortId: cid,
            status: 'completed',
          });
          cohortCtrl.handleAddJob({ jobId: 'job-real-1', cohortId: cid });
          cohortCtrl.handleAddJob({ jobId: 'job-real-2', cohortId: cid });

          // Trigger cohort job completion
          cohortCtrl.handleJobCompleted({ jobId: 'job-real-2' });
        }
      },
      { cid: cohortId }
    );

    // 4. Assert cohort card and analysis section appeared
    const cohortCard = page.locator(`#cohort-${cohortId}`);
    await expect(cohortCard).toBeVisible();

    const analysisSection = cohortCard.locator('.cohort-analysis');
    await expect(analysisSection).toBeVisible();

    const analyzeBtn = cohortCard.locator('.cohort-analyze-btn');
    await expect(analyzeBtn).toBeVisible();
    await expect(analyzeBtn).toHaveText('Run Joint Analysis');

    // 5. Click Run Joint Analysis
    await analyzeBtn.click();

    // 6. Verify transition to completed with direct zip download link
    const downloadBtn = cohortCard.locator('.cohort-download-btn');
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toHaveText(/Download Cohort Results/i);
    await expect(downloadBtn).toHaveAttribute('download', `cohort_${cohortId}_results.zip`);
    await expect(downloadBtn).toHaveAttribute('href', new RegExp(analysisJobId));

    // Verify zero uncaught page errors
    expect(errors, `Uncaught page errors: ${errors.join('; ')}`).toEqual([]);
  });
});
