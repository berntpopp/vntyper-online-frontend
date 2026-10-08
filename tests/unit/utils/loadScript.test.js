import { describe, it, expect, beforeEach } from 'vitest';
import { loadCdnAsset } from '../../../resources/js/utils/loadScript.js';

describe('loadCdnAsset', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('injects a script once with SRI and shares the request between callers', async () => {
    const first = loadCdnAsset('https://cdn.example/a.js', 'sha384-abc');
    const second = loadCdnAsset('https://cdn.example/a.js', 'sha384-abc');

    const scripts = document.head.querySelectorAll('script');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe('https://cdn.example/a.js');
    expect(scripts[0].integrity).toBe('sha384-abc');
    expect(scripts[0].crossOrigin).toBe('anonymous');

    scripts[0].dispatchEvent(new Event('load'));
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
  });

  it('injects a stylesheet link for .css URLs', () => {
    loadCdnAsset('https://cdn.example/b.css', 'sha384-def');

    const link = document.head.querySelector('link');
    expect(link?.rel).toBe('stylesheet');
    expect(link?.href).toBe('https://cdn.example/b.css');
  });

  it('rejects on a failed load and allows a retry', async () => {
    const failed = loadCdnAsset('https://cdn.example/c.js', 'sha384-ghi');
    document.head.querySelector('script')?.dispatchEvent(new Event('error'));
    await expect(failed).rejects.toThrow('Failed to load https://cdn.example/c.js');

    loadCdnAsset('https://cdn.example/c.js', 'sha384-ghi');
    expect(document.head.querySelectorAll('script')).toHaveLength(2);
  });
});
