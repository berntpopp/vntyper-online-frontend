// tests/unit/navbar.test.js

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeNavbar } from '../../resources/js/navbar.js';

vi.mock('../../resources/js/log.js', () => ({
  logMessage: vi.fn(),
}));

describe('navbar.js - initializeNavbar', () => {
  beforeEach(() => {
    delete window.CONFIG;
    document.body.innerHTML = `
      <ul class="navbar-menu" id="navbar-menu">
        <li><a href="/api/docs" id="apiDocsLink" class="navbar-link">API</a></li>
      </ul>
    `;
  });

  afterEach(() => {
    delete window.CONFIG;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('updates apiDocsLink href using window.CONFIG.API_DOCS_URL when configured', () => {
    window.CONFIG = {
      API_URL: 'http://localhost:8000/api',
      API_DOCS_URL: 'https://docs.custom-vntyper.org',
      institutions: [],
    };

    initializeNavbar();

    const link = /** @type {HTMLAnchorElement} */ (document.getElementById('apiDocsLink'));
    expect(link.href).toBe('https://docs.custom-vntyper.org/');
  });

  it('falls back to ${API_URL}/docs when API_DOCS_URL is omitted', () => {
    window.CONFIG = {
      API_URL: 'http://localhost:8000/api',
      institutions: [],
    };

    initializeNavbar();

    const link = /** @type {HTMLAnchorElement} */ (document.getElementById('apiDocsLink'));
    expect(link.href).toBe('http://localhost:8000/api/docs');
  });

  it('falls back to /api/docs when window.CONFIG is undefined', () => {
    delete window.CONFIG;

    initializeNavbar();

    const link = /** @type {HTMLAnchorElement} */ (document.getElementById('apiDocsLink'));
    expect(link.getAttribute('href')).toBe('/api/docs');
  });

  it('safely handles missing apiDocsLink element without throwing', () => {
    document.body.innerHTML = '<div>No navbar here</div>';
    window.CONFIG = {
      API_URL: 'http://localhost:8000/api',
      institutions: [],
    };

    expect(() => initializeNavbar()).not.toThrow();
  });
});
