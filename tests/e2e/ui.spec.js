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
