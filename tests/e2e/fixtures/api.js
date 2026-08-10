// Shared end-to-end fixtures.
//
// SCOPE OF MOCKING: only the VNtyper backend is stubbed. CDN assets
// (intro.js, BioWasm Aioli) are deliberately left alone - index.html loads
// them with Subresource Integrity, and the browser hashes the bytes it
// actually receives, so a stubbed response fails SRI and the page breaks.
// These tests therefore need network access to those CDNs.

// resources/js/config.js sets API_URL to http://localhost:8000/api when the
// page is served on port 3000, which is how the dev server runs.
const API = 'http://localhost:8000/api';

export const FIXTURES = {
  version: { api_version: '1.2.3', tool_version: '2.0.0' },
  usageStatistics: { total_jobs: 42, jobs_last_24h: 7 },
  jobQueue: { queue_length: 0, running: 0 },
};

/**
 * Skip the disclaimer gate.
 *
 * resources/js/disclaimer.js sets disclaimerModal.style.display = 'block' on
 * load unless the cookie is present, and focuses #agreeBtn. Without this,
 * every interaction test fails on an intercepted click.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function acknowledgeDisclaimer(page) {
  await page.context().addCookies([
    {
      name: 'disclaimerAcknowledged',
      value: 'true',
      url: 'http://localhost:3000',
    },
  ]);
}

/**
 * Stub the backend API. Any backend request without a fixture fails the test
 * loudly, so a renamed endpoint surfaces as a clear error rather than a hang.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, unknown>} [overrides] Keyed by URL fragment.
 */
export async function mockApi(page, overrides = {}) {
  const routes = {
    '/version/': FIXTURES.version,
    '/usage-statistics/': FIXTURES.usageStatistics,
    '/job-queue/': FIXTURES.jobQueue,
    ...overrides,
  };

  await page.route(`${API}/**`, async route => {
    const url = route.request().url();
    const match = Object.keys(routes).find(fragment => url.includes(fragment));

    if (!match) {
      await route.fulfill({ status: 501, body: `Unmocked API request: ${url}` });
      throw new Error(`Unmocked API request: ${url}. Add a fixture in tests/e2e/fixtures/api.js`);
    }

    await route.fulfill({ json: routes[match] });
  });
}

/**
 * Collect uncaught page errors for assertion.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {string[]} Live array, appended to as errors occur.
 */
export function collectPageErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}
