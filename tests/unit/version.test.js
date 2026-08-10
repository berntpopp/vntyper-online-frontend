// tests/unit/version.test.js

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../resources/js/log.js', () => ({
  logMessage: vi.fn(),
}));

/**
 * version.js is loaded by all five pages, but only index.html loads config.js.
 * The module must therefore survive window.CONFIG being absent.
 */
describe('version.js', () => {
  // The frontend version is duplicated in package.json, here, and in 13 ?v=
  // cache-busters in index.html. Asserting only the *shape* of the string is
  // what let commit 1799d05 ship a stale constant; assert the value.
  it('frontendVersion matches package.json', async () => {
    // Resolve from process.cwd(), not import.meta.url: under the jsdom
    // environment import.meta.url is an http:// URL and node:fs rejects it.
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = process.cwd();

    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const source = readFileSync(join(root, 'resources/js/version.js'), 'utf8');
    const match = source.match(/const frontendVersion = '([^']+)'/);

    expect(match, 'frontendVersion declaration not found').not.toBeNull();
    expect(match[1]).toBe(pkg.version);
  });

  beforeEach(() => {
    vi.resetModules();
    delete window.CONFIG;
    document.body.innerHTML = `
      <span id="currentYear"></span>
      <span id="appVersion"></span>
      <span id="apiVersion">N/A</span>
      <span id="toolVersion">N/A</span>
    `;
  });

  afterEach(() => {
    delete window.CONFIG;
    document.body.innerHTML = '';
    // vi.restoreAllMocks() does not undo a plain assignment to global.fetch.
    delete global.fetch;
    vi.restoreAllMocks();
    // Each resetModules() + import registers another DOMContentLoaded
    // listener on `document`. Replace the document body's listener target by
    // recreating the element the handlers write into, and drop the module
    // registry so the next test starts clean.
    vi.resetModules();
  });

  describe('without window.CONFIG (contact, imprints, adtkd pages)', () => {
    it('imports without throwing', async () => {
      await expect(import('../../resources/js/version.js')).resolves.toBeDefined();
    });

    it('still renders the current year', async () => {
      await import('../../resources/js/version.js');

      document.dispatchEvent(new Event('DOMContentLoaded'));
      await Promise.resolve();

      expect(document.getElementById('currentYear').textContent).toBe(
        String(new Date().getFullYear())
      );
    });

    it('still renders the frontend version', async () => {
      await import('../../resources/js/version.js');

      document.dispatchEvent(new Event('DOMContentLoaded'));
      await Promise.resolve();

      expect(document.getElementById('appVersion').textContent).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('does not attempt an API request', async () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      await import('../../resources/js/version.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      await Promise.resolve();

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('with window.CONFIG (index.html)', () => {
    it('fetches versions from the configured endpoint', async () => {
      window.CONFIG = { API_URL: 'http://localhost:8000/api' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ api_version: '1.2.3', tool_version: '2.0.0' }),
      });

      await import('../../resources/js/version.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      await vi.waitFor(() => {
        expect(document.getElementById('apiVersion').textContent).toBe('1.2.3');
      });

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/version/');
      expect(document.getElementById('toolVersion').textContent).toBe('2.0.0');
    });
  });
});
