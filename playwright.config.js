import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the real page served by scripts/dev-server.mjs,
// which mirrors production's web root.
//
// These tests are NOT offline. index.html loads intro.js and BioWasm's Aioli
// from CDNs with Subresource Integrity, and the browser verifies the hash of
// the bytes it actually receives - so intercepting those requests and
// fulfilling them with stubs makes the page fail to load. Only the VNtyper
// backend API is stubbed; CDN assets are fetched for real. See
// tests/e2e/fixtures/api.js.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: 'node scripts/dev-server.mjs',
    // Port 3000 is required: resources/js/config.js keys dev mode off it.
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
