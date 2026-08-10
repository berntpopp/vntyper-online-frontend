// frontend/resources/js/loadDeferredStyles.js
// Promote non-blocking preloaded stylesheets (<link rel="preload" as="style">) to applied
// stylesheets. This replaces an inline `onload="this.rel='stylesheet'"` handler, which a strict
// Content-Security-Policy (no 'unsafe-inline' / 'unsafe-hashes') blocks. Setting rel="stylesheet"
// applies the already-fetched preload without re-downloading and keeps the load non-render-blocking.
// The selector only ever matches <link> elements, but querySelectorAll cannot infer that from an
// attribute selector, so the element type is narrowed here to make `.rel` assignable.
const preloadedStyles = /** @type {NodeListOf<HTMLLinkElement>} */ (
  document.querySelectorAll('link[rel="preload"][as="style"]')
);
preloadedStyles.forEach(link => {
  link.rel = 'stylesheet';
});
