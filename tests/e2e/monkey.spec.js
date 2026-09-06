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
});
