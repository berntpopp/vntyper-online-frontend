import { test, expect } from '@playwright/test';
import { mockApi, acknowledgeDisclaimer } from './fixtures/api.js';

// File selection runs entirely in the browser - no backend involved - so these
// exercise the real pairing logic in inputWrangling.js and fileSelection.js.
// Every assertion below was verified against the running page rather than read
// off the source, because the two disagree.
test.describe('file selection', () => {
  test.beforeEach(async ({ page }) => {
    await acknowledgeDisclaimer(page);
    await mockApi(page);
    await page.goto('/');
  });

  test('a matched BAM and BAI pair is accepted', async ({ page }) => {
    await page.locator('#bamFiles').setInputFiles([
      { name: 'sample.bam', mimeType: 'application/octet-stream', buffer: Buffer.from('BAM') },
      { name: 'sample.bam.bai', mimeType: 'application/octet-stream', buffer: Buffer.from('BAI') },
    ]);

    await expect(page.locator('#fileList')).toContainText('sample.bam');
    await expect(page.locator('#error')).toBeEmpty();
  });

  test('a BAM with no index is rejected and named in the error', async ({ page }) => {
    await page
      .locator('#bamFiles')
      .setInputFiles([
        { name: 'lonely.bam', mimeType: 'application/octet-stream', buffer: Buffer.from('BAM') },
      ]);

    await expect(page.locator('#error')).toContainText(/invalid/i);
    await expect(page.locator('#error')).toContainText('lonely.bam');
    await expect(page.locator('#fileList')).toContainText(/no files selected/i);
  });

  // Documents a real gap rather than asserting it is correct: an unsupported
  // extension is discarded with NO message at all, so the user sees their file
  // vanish. A lone .bam at least explains itself. Worth fixing; until then this
  // test will fail the moment the behaviour changes, which is the point.
  test('an unsupported file type is silently discarded', async ({ page }) => {
    await page
      .locator('#bamFiles')
      .setInputFiles([
        { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a bam') },
      ]);

    await expect(page.locator('#fileList')).toContainText(/no files selected/i);
    await expect(page.locator('#error')).toBeEmpty();
  });
});
