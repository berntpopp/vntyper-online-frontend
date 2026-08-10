// tests/unit/utils/safeStorage.test.js

import { describe, it, expect, afterEach, vi } from 'vitest';
import { safeStorage } from '../../../resources/js/utils/safeStorage.js';

describe('safeStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('when localStorage works', () => {
    it('reads, writes and removes through to localStorage', () => {
      expect(safeStorage.setItem('k', 'v')).toBe(true);
      expect(safeStorage.getItem('k')).toBe('v');
      expect(safeStorage.removeItem('k')).toBe(true);
      expect(safeStorage.getItem('k')).toBeNull();
    });

    it('returns null for an absent key', () => {
      expect(safeStorage.getItem('never-set')).toBeNull();
    });
  });

  describe('when storage access is blocked (SecurityError)', () => {
    it('getItem returns null instead of throwing', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

      expect(() => safeStorage.getItem('k')).not.toThrow();
      expect(safeStorage.getItem('k')).toBeNull();
    });

    it('setItem returns false instead of throwing', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

      expect(() => safeStorage.setItem('k', 'v')).not.toThrow();
      expect(safeStorage.setItem('k', 'v')).toBe(false);
    });

    it('removeItem returns false instead of throwing', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

      expect(() => safeStorage.removeItem('k')).not.toThrow();
      expect(safeStorage.removeItem('k')).toBe(false);
    });
  });

  describe('when the quota is exceeded', () => {
    it('setItem returns false instead of throwing', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });

      expect(safeStorage.setItem('k', 'v')).toBe(false);
    });
  });
});

/**
 * Integration guard: proves the call sites were actually migrated, not just
 * that the wrapper exists. Before the migration these initializers called
 * localStorage directly and threw straight out of initializeApp.
 */
describe('modules that persist UI state survive blocked storage', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function blockStorage() {
    // jsdom does not implement Element.scrollTo; log.js scrolls its panel.
    Element.prototype.scrollTo = Element.prototype.scrollTo || vi.fn();

    const boom = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom);
  }

  it('initializeLogging() does not throw when localStorage is blocked', async () => {
    document.body.innerHTML = `
      <button id="toggleLogBtn"></button>
      <div id="logContainer">
        <button class="close-log-btn"></button>
        <button class="clear-log-btn"></button>
        <button class="log-filter-btn" data-level="all"></button>
        <div id="logContent"></div>
      </div>
      <button id="downloadLogsBtn"></button>
      <select id="downloadFormatSelect"><option value="txt">TXT</option></select>
    `;
    blockStorage();

    const { initializeLogging } = await import('../../../resources/js/log.js');

    expect(() => initializeLogging()).not.toThrow();
  });

  it('initializeUsageStats() does not throw when localStorage is blocked', async () => {
    document.body.innerHTML = `
      <button id="toggleStatsBtn"></button>
      <div id="usageStatsContainer">
        <button class="close-stats-btn"></button>
        <div id="usageStatsContent"></div>
      </div>
    `;
    blockStorage();

    const { initializeUsageStats } = await import('../../../resources/js/usageStats.js');

    expect(() => initializeUsageStats()).not.toThrow();
  });
});
