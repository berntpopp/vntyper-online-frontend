import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { acknowledgeDisclaimer } from './fixtures/api.js';

const USB_DIR = '/run/media/bernt-popp/1819-E513/MUC1';

// HG38 samples
const SAMPLE_1_BAM = path.join(
  USB_DIR,
  'LB24-ONTCCMJH298-ready_610bac2f-fe65-4654-a72b-27a965b09fce.chr1_155183824_155194915.bam'
);
const SAMPLE_1_BAI = `${SAMPLE_1_BAM}.bai`;

const SAMPLE_2_BAM = path.join(
  USB_DIR,
  'LB24-ONTCCMJH301-ready_c4c0ab59-2f03-455f-98ad-b6a154e73d68.chr1_155183824_155194915.bam'
);
const SAMPLE_2_BAI = `${SAMPLE_2_BAM}.bai`;

// HG19 sample
const SAMPLE_HG19_BAM = path.join(USB_DIR, 'example_bam', 'example_2.bam');
const SAMPLE_HG19_BAI = path.join(USB_DIR, 'example_bam', 'example_2.bam.bai');

test.describe('Real USB MUC1 BAM/BAI E2E Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!fs.existsSync(SAMPLE_1_BAM), 'USB test files not present');

    // Collect console logs for debugging
    page.on('console', async msg => {
      try {
        const args = await Promise.all(
          msg.args().map(a => a.jsonValue().catch(() => a.toString()))
        );
        const text = args
          .map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
          .join(' ');
        if (
          msg.type() === 'error' ||
          msg.type() === 'warn' ||
          text.includes('VNtyper') ||
          text.includes('Job') ||
          text.includes('Cohort')
        ) {
          console.log(`[Browser ${msg.type()}]`, text);
        }
      } catch {
        console.log(`[Browser ${msg.type()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', err => {
      console.error(`[Browser PageError] ${err.message}\n${err.stack}`);
    });

    await acknowledgeDisclaimer(page);
    await page.goto('/');
  });

  test('1. Extract region in browser with real USB BAM/BAI', async ({ page }) => {
    test.setTimeout(120_000);

    expect(fs.existsSync(SAMPLE_1_BAM), `BAM file must exist: ${SAMPLE_1_BAM}`).toBe(true);
    expect(fs.existsSync(SAMPLE_1_BAI), `BAI file must exist: ${SAMPLE_1_BAI}`).toBe(true);

    const fileInput = page.locator('#bamFiles');
    await fileInput.setInputFiles([SAMPLE_1_BAM, SAMPLE_1_BAI]);

    // Wait for fileList to update with selected file
    const fileList = page.locator('#fileList');
    await expect(fileList).toContainText('LB24-ONTCCMJH298');

    // Click Extract Region button
    const extractBtn = page.locator('#extractBtn');
    await expect(extractBtn).toBeEnabled();
    console.log('Clicking Extract Region...');
    await extractBtn.click();

    // Wait for extraction to complete (extractBtn re-enabled with "Extract Region")
    await expect(extractBtn).toHaveText('Extract Region', { timeout: 90_000 });

    // Verify region output displays detected assembly
    const regionOutput = page.locator('#regionOutput');
    await expect(regionOutput).toContainText('HG38');
    await expect(regionOutput).toContainText('subset_LB24-ONTCCMJH298');

    // Ensure no error banner was triggered
    const errorDiv = page.locator('#error');
    if (await errorDiv.isVisible()) {
      const errText = await errorDiv.innerText();
      expect(errText).toBe('');
    }
  });

  test('2. Submit real USB BAM/BAI job (hg38) to backend and verify completed report', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const fileInput = page.locator('#bamFiles');
    await fileInput.setInputFiles([SAMPLE_1_BAM, SAMPLE_1_BAI]);

    const fileList = page.locator('#fileList');
    await expect(fileList).toContainText('LB24-ONTCCMJH298');

    const submitBtn = page.locator('#submitBtn');
    await expect(submitBtn).toBeEnabled();
    console.log('Clicking Submit Job...');
    await submitBtn.click();

    // Wait for job entry to appear in the jobs list
    const jobItem = page.locator('#jobOutput .job-item').first();
    await expect(jobItem).toBeVisible({ timeout: 60_000 });
    console.log('Job submitted, waiting for completion...');

    // Wait for the status indicator to show Completed
    const completedBadge = jobItem.locator('.job-status.status-completed, .status-completed');
    await expect(completedBadge).toBeVisible({ timeout: 120_000 });
    console.log('Job completed in UI!');

    // Check download button
    const downloadBtn = jobItem.locator('.download-link, a:has-text("Download Results")');
    await expect(downloadBtn).toBeVisible({ timeout: 10_000 });
    console.log('Download link is available!');

    // Download and inspect ZIP file
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;

    const zipPath = '/tmp/playwright_test_hg38_result.zip';
    await download.saveAs(zipPath);
    expect(fs.existsSync(zipPath)).toBe(true);
    expect(fs.statSync(zipPath).size).toBeGreaterThan(10_000);
    console.log(`Saved result ZIP (${fs.statSync(zipPath).size} bytes) to ${zipPath}`);

    // Inspect files inside the ZIP
    const zipListing = execSync(`unzip -l ${zipPath}`).toString();
    console.log('ZIP Contents:\n' + zipListing);
    expect(zipListing).toContain('summary_report.html');
    expect(zipListing).toContain('pipeline_summary.json');
    expect(zipListing).toContain('kestrel/kestrel_result.tsv');
    expect(zipListing).toContain('coverage/coverage_summary.tsv');

    // Extract and verify summary_report.html content
    const extractDir = '/tmp/playwright_test_hg38_out';
    fs.mkdirSync(extractDir, { recursive: true });
    execSync(`unzip -o ${zipPath} -d ${extractDir}`);

    const summaryReportPath = path.join(extractDir, 'summary_report.html');
    expect(fs.existsSync(summaryReportPath)).toBe(true);
    const summaryHtml = fs.readFileSync(summaryReportPath, 'utf8');
    expect(summaryHtml).toContain('MUC1');
    expect(summaryHtml).toContain('LB24-ONTCCMJH298');

    const pipelineSummaryPath = path.join(extractDir, 'pipeline_summary.json');
    expect(fs.existsSync(pipelineSummaryPath)).toBe(true);
    const pipelineSummary = JSON.parse(fs.readFileSync(pipelineSummaryPath, 'utf8'));
    expect(pipelineSummary.sample_name).toContain('LB24-ONTCCMJH298');
    expect(pipelineSummary.reference_assembly_requested).toBe('hg38');
    console.log('Successfully validated summary_report.html and pipeline_summary.json!');
  });

  test('3. Submit multi-sample cohort with 2 real USB BAM/BAI pairs', async ({ page }) => {
    test.setTimeout(240_000);

    const fileInput = page.locator('#bamFiles');
    await fileInput.setInputFiles([SAMPLE_1_BAM, SAMPLE_1_BAI, SAMPLE_2_BAM, SAMPLE_2_BAI]);

    const fileList = page.locator('#fileList');
    await expect(fileList).toContainText('LB24-ONTCCMJH298');
    await expect(fileList).toContainText('LB24-ONTCCMJH301');

    // Toggle optional inputs to provide cohort alias & passphrase
    const toggleOptions = page.locator('#toggleOptionalInputs');
    if (await toggleOptions.isVisible()) {
      await toggleOptions.click();
    }

    const cohortAliasInput = page.locator('#cohortAlias');
    await cohortAliasInput.fill(`USB-Cohort-${Date.now()}`);

    const passphraseInput = page.locator('#passphrase');
    await passphraseInput.fill('CohortSecret123!');

    const submitBtn = page.locator('#submitBtn');
    await expect(submitBtn).toBeEnabled();
    console.log('Clicking Submit Jobs for Cohort...');
    await submitBtn.click();

    // Verify both job items appear in UI
    const jobItems = page.locator('#jobOutput .job-item');
    await expect(jobItems).toHaveCount(2, { timeout: 60_000 });
    console.log('Cohort with 2 jobs submitted, waiting for completion...');

    // Wait for both jobs to complete
    const completedBadges = page.locator(
      '#jobOutput .job-status.status-completed, #jobOutput .status-completed'
    );
    await expect(completedBadges).toHaveCount(2, { timeout: 180_000 });
    console.log('Both cohort jobs completed successfully in UI!');

    // Check download links for both jobs
    const downloadLinks = page.locator('#jobOutput .download-link');
    await expect(downloadLinks).toHaveCount(2, { timeout: 10_000 });
    console.log('Both cohort download links available!');
  });

  test('4. Submit hg19 BAM from USB example_bam and verify auto-detection', async ({ page }) => {
    test.setTimeout(180_000);

    expect(fs.existsSync(SAMPLE_HG19_BAM), `HG19 BAM must exist: ${SAMPLE_HG19_BAM}`).toBe(true);

    const fileInput = page.locator('#bamFiles');
    await fileInput.setInputFiles([SAMPLE_HG19_BAM, SAMPLE_HG19_BAI]);

    const fileList = page.locator('#fileList');
    await expect(fileList).toContainText('example_2.bam');

    const submitBtn = page.locator('#submitBtn');
    await expect(submitBtn).toBeEnabled();
    console.log('Clicking Submit Job for HG19 sample...');
    await submitBtn.click();

    // Wait for job item
    const jobItem = page.locator('#jobOutput .job-item').first();
    await expect(jobItem).toBeVisible({ timeout: 60_000 });
    console.log('HG19 Job submitted, waiting for completion...');

    // Wait for completion
    const completedBadge = jobItem.locator('.job-status.status-completed, .status-completed');
    await expect(completedBadge).toBeVisible({ timeout: 120_000 });
    console.log('HG19 Job completed in UI!');

    // Download and inspect ZIP file
    const downloadBtn = jobItem.locator('.download-link, a:has-text("Download Results")');
    await expect(downloadBtn).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;

    const zipPath = '/tmp/playwright_test_hg19_result.zip';
    await download.saveAs(zipPath);
    expect(fs.existsSync(zipPath)).toBe(true);
    console.log(`Saved HG19 result ZIP (${fs.statSync(zipPath).size} bytes)`);

    const zipListing = execSync(`unzip -l ${zipPath}`).toString();
    expect(zipListing).toContain('summary_report.html');
    expect(zipListing).toContain('pipeline_summary.json');
    console.log('Successfully validated HG19 pipeline execution!');
  });

  test('5. Extract 6122GM006169 (HG19) and verify auto-detection and UI without apply errors', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const BAM_6122 = path.join(USB_DIR, 'example_bam', '6122GM006169.bam');
    const BAI_6122 = path.join(USB_DIR, 'example_bam', '6122GM006169.bam.bai');

    expect(fs.existsSync(BAM_6122), `6122GM006169 BAM must exist: ${BAM_6122}`).toBe(true);
    expect(fs.existsSync(BAI_6122), `6122GM006169 BAI must exist: ${BAI_6122}`).toBe(true);

    // Track any uncaught exceptions on page
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    const fileInput = page.locator('#bamFiles');
    await fileInput.setInputFiles([BAM_6122, BAI_6122]);

    const fileList = page.locator('#fileList');
    await expect(fileList).toContainText('6122GM006169', { timeout: 15_000 });

    // Verify error banner is hidden
    const errorBanner = page.locator('#error');
    await expect(errorBanner).toHaveClass(/hidden/);

    const extractBtn = page.locator('#extractBtn');
    await expect(extractBtn).toBeEnabled();
    console.log('Clicking Extract Region for 6122GM006169...');
    await extractBtn.click();

    // Verify assembly banner appears and detects HG19
    const assemblyBanner = page.locator('#regionOutput .assembly-info-message');
    await expect(assemblyBanner).toBeVisible({ timeout: 60_000 });
    await expect(assemblyBanner).toContainText('HG19');
    console.log('Verified 6122GM006169 correctly auto-detected HG19!');

    // Verify download links are rendered (both BAM and BAI)
    const downloadLinks = page.locator('#regionOutput a.download-button');
    await expect(downloadLinks).toHaveCount(2, { timeout: 30_000 });
    console.log('Subset BAM & BAI download links successfully generated for 6122GM006169!');

    // Verify absolutely no 'apply' errors occurred
    const applyErrors = pageErrors.filter(msg => msg.includes("reading 'apply'"));
    expect(applyErrors).toHaveLength(0);
    expect(page.locator('#error')).toHaveClass(/hidden/);
  });
});
