import { test, expect } from '@playwright/test';
import { mockApi, acknowledgeDisclaimer, collectPageErrors } from './fixtures/api.js';

test.describe('page load', () => {
  test('renders and reports the frontend version', async ({ page }) => {
    const errors = collectPageErrors(page);

    await acknowledgeDisclaimer(page);
    await mockApi(page);
    await page.goto('/');

    await expect(page.locator('#appVersion')).toHaveText(/^\d+\.\d+\.\d+$/);
    expect(errors, `uncaught page errors: ${errors.join('; ')}`).toEqual([]);
  });

  // version.js runs on all five pages but config.js only on index.html, so the
  // secondary pages exercise the no-window.CONFIG path. Commit d8b9ddd is that
  // path breaking and blanking the footer year on four pages.
  for (const path of [
    '/contact.html',
    '/impressum_en.html',
    '/impressum_de.html',
    '/adtkd_diagnostics.html',
  ]) {
    test(`${path} loads and fills the footer year`, async ({ page }) => {
      const errors = collectPageErrors(page);

      const response = await page.goto(path);
      expect(response?.status()).toBe(200);

      await expect(page.locator('#currentYear')).toHaveText(/^\d{4}$/);
      expect(errors, `uncaught page errors: ${errors.join('; ')}`).toEqual([]);
    });
  }
});
