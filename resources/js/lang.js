// resources/js/lang.js
// Sends a first-time visitor on an English page to their browser language, and
// remembers a language picked in the switcher so they are never moved again.
// Loaded as a classic script in <head>, after the hreflang links it reads -
// those links are the list of available languages (see scripts/sync-i18n.mjs).

(() => {
  const KEY = 'vntyper-lang';
  /** @param {string} lang */
  const alternate = lang =>
    document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`)?.getAttribute('href');

  const stored = () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return 'blocked'; // storage unavailable: never redirect, there is no way to opt out
    }
  };

  document.addEventListener('click', event => {
    const link = /** @type {Element} */ (event.target).closest?.('.lang-switch a[hreflang]');
    if (!link) return;
    try {
      localStorage.setItem(KEY, link.getAttribute('hreflang') ?? '');
    } catch {
      /* the choice simply is not remembered */
    }
  });

  // Only the default-language pages redirect: a link to /fr/ is an explicit choice.
  const here = document.documentElement.lang;
  if (stored() || alternate(here) !== alternate('x-default')) return;

  const wanted = navigator.languages.map(tag => tag.slice(0, 2).toLowerCase()).find(alternate);
  if (!wanted || wanted === here) return;
  // Alternates are absolute production URLs; keep the current origin (dev, staging).
  const { pathname } = new URL(/** @type {string} */ (alternate(wanted)));
  location.replace(pathname + location.search + location.hash);
})();
