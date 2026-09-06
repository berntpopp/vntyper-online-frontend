import { test, expect } from '@playwright/test';
import { mockApi, acknowledgeDisclaimer } from './fixtures/api.js';

test.describe('disclaimer gate', () => {
  test('blocks the page until acknowledged, then stays dismissed', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');

    const modal = page.locator('#disclaimerModal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#agreeBtn')).toBeFocused();

    await page.locator('#agreeBtn').click();
    await expect(modal).toBeHidden();

    // The acknowledgement is stored in a cookie, so it survives a reload.
    await page.reload();
    await expect(modal).toBeHidden();
  });
});

test.describe('modals', () => {
  test.beforeEach(async ({ page }) => {
    await acknowledgeDisclaimer(page);
    await mockApi(page);
    await page.goto('/');
  });

  // Desktop only. index.html ships two a[data-modal="faqModal"] links, but
  // footer.js rebuilds #footerLinks from window.CONFIG.institutions and drops
  // the footer copy, so exactly one survives - the navbar one, which lives
  // inside the collapsed menu at mobile widths.
  test('the FAQ modal opens and closes', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the only surviving FAQ link is inside the collapsed mobile menu');

    const modal = page.locator('#faqModal');
    await expect(modal).toHaveAttribute('aria-hidden', 'true');

    const faqLink = page.locator('a[data-modal="faqModal"]');
    await expect(faqLink).toBeVisible();
    await faqLink.click();

    await expect(modal).not.toHaveAttribute('aria-hidden', 'true');

    // Focus moves inside the dialog in a requestAnimationFrame, and the Escape
    // handler is attached to the modal itself - so Escape only closes it once
    // focus has actually landed. Waiting for that is also the a11y assertion:
    // opening a dialog must move focus into it.
    await expect(modal.locator('.modal-close')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(modal).toHaveAttribute('aria-hidden', 'true');
  });

  test('the log panel toggles and reports its state', async ({ page }) => {
    const toggle = page.locator('#toggleLogBtn');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('the stats panel toggles and reports its state', async ({ page }) => {
    const toggle = page.locator('#toggleStatsBtn');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('footer utility controls are centered within the footer', async ({ page }) => {
    const container = page.locator('.footer-utility-actions');
    await expect(container).toBeVisible();
    const style = await container.evaluate(el => window.getComputedStyle(el).justifyContent);
    expect(style).toBe('center');
  });

  test('footer text and navigation links are centered within the footer', async ({ page }) => {
    const footerBottom = page.locator('.footer-bottom');
    await expect(footerBottom).toBeVisible();
    const style = await footerBottom.evaluate(el => window.getComputedStyle(el).alignItems);
    expect(style).toBe('center');

    const firstP = footerBottom.locator('p').first();
    const pAlign = await firstP.evaluate(el => window.getComputedStyle(el).textAlign);
    expect(pAlign).toBe('center');

    const links = await footerBottom.locator('a').all();
    expect(links.length).toBeGreaterThanOrEqual(3);
    const firstBox = await links[0].boundingBox();
    const lastBox = await links[links.length - 1].boundingBox();
    const containerBox = await footerBottom.boundingBox();
    if (firstBox && lastBox && containerBox) {
      const linksCenter = (firstBox.x + lastBox.x + lastBox.width) / 2;
      const containerCenter = containerBox.x + containerBox.width / 2;
      expect(Math.abs(linksCenter - containerCenter)).toBeLessThan(5);
    }
  });
});

test.describe('mobile navigation', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile viewport only');

  test('the hamburger toggles the menu', async ({ page }) => {
    await acknowledgeDisclaimer(page);
    await mockApi(page);
    await page.goto('/');

    const toggle = page.locator('button.navbar-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#navbar-menu')).toBeVisible();
  });
});

test.describe('navbar navigation', () => {
  test('API documentation link points to configured API docs endpoint and dev server proxies it', async ({
    page,
    request,
    isMobile,
  }) => {
    test.skip(isMobile, 'desktop navbar visibility');
    await acknowledgeDisclaimer(page);
    await mockApi(page);
    await page.goto('/');

    const apiLink = page.locator('#apiDocsLink');
    await expect(apiLink).toBeVisible();
    await expect(apiLink).toHaveAttribute('target', '_blank');
    await expect(apiLink).toHaveAttribute('rel', 'noopener noreferrer');
    // In dev mode (port 3000), configured to point directly to backend docs:
    await expect(apiLink).toHaveAttribute('href', 'http://localhost:8000/api/docs');

    // Dev server also proxies /api/docs directly:
    const devDocsResponse = await request.get('/api/docs');
    expect(devDocsResponse.status()).toBe(200);
  });
});
