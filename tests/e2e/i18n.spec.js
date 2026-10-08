import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockApi, acknowledgeDisclaimer, collectPageErrors } from './fixtures/api.js';

const { locales, pages } = JSON.parse(readFileSync('i18n/config.json', 'utf8'));

test.describe('translated pages', () => {
  for (const locale of Object.keys(locales)) {
    for (const file of pages) {
      const path = `/${locale}/${file === 'index.html' ? '' : file}`;

      test(`${path} loads in its language`, async ({ page }) => {
        const errors = collectPageErrors(page);
        await acknowledgeDisclaimer(page);
        await mockApi(page);

        const response = await page.goto(path);
        expect(response?.status()).toBe(200);

        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        // Shared scripts and styles are referenced from the site root.
        await expect(page.locator('#currentYear')).toHaveText(/^\d{4}$/);
        // Text set by JavaScript is translated too, not reverted to English.
        if (file === 'index.html') {
          const strings = await page.evaluate(() => window.I18N ?? {});
          await expect(page.locator('#submitBtn')).toHaveText(strings['Submit Jobs']);
        }
        expect(errors, `uncaught page errors: ${errors.join('; ')}`).toEqual([]);
      });
    }
  }
});

test.describe('browser language', () => {
  test.use({ locale: 'de-DE' });

  test('first visit goes to the browser language, a switcher choice sticks', async ({ page }) => {
    await page.goto('/contact.html?x=1#top');
    await expect(page).toHaveURL(/\/de\/contact\.html\?x=1#top$/);

    await page.locator('.lang-switch summary').click();
    await page.locator('.lang-switch a[hreflang="en"]').click();
    await expect(page).toHaveURL(/^http:\/\/[^/]+\/contact\.html$/);

    await page.reload();
    await expect(page).toHaveURL(/^http:\/\/[^/]+\/contact\.html$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('a direct link to another language is left alone', async ({ page }) => {
    await page.goto('/fr/contact.html');
    await expect(page).toHaveURL(/\/fr\/contact\.html$/);
  });
});
