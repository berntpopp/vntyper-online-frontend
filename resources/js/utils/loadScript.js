// frontend/resources/js/utils/loadScript.js

/** @type {Map<string, Promise<void>>} */
const pending = new Map();

/**
 * Load a CDN asset once, on demand, with Subresource Integrity.
 *
 * Keeps rarely-used third-party code (the tutorial, the WebAssembly runtime)
 * out of the initial page load. Repeat calls share the first request.
 *
 * @param {string} url - Pinned, version-specific URL of a .js or .css file.
 * @param {string} integrity - SRI hash the browser verifies before applying it.
 * @returns {Promise<void>} Resolves once the asset is applied; rejects if it fails to load.
 */
export function loadCdnAsset(url, integrity) {
  let promise = pending.get(url);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const isCss = url.endsWith('.css');
      const el = document.createElement(isCss ? 'link' : 'script');
      if (el instanceof HTMLLinkElement) {
        el.rel = 'stylesheet';
        el.href = url;
      } else {
        el.src = url;
      }
      el.integrity = integrity;
      el.crossOrigin = 'anonymous';
      el.addEventListener('load', () => resolve());
      el.addEventListener('error', () => {
        pending.delete(url); // allow a retry after a network failure
        reject(new Error(`Failed to load ${url}`));
      });
      document.head.append(el);
    });
    pending.set(url, promise);
  }
  return promise;
}
