// frontend/resources/js/loadDeferredStyles.js
// Promote non-blocking preloaded stylesheets (<link rel="preload" as="style">) to applied
// stylesheets. This replaces an inline `onload="this.rel='stylesheet'"` handler, which a strict
// Content-Security-Policy (no 'unsafe-inline' / 'unsafe-hashes') blocks. Setting rel="stylesheet"
// applies the already-fetched preload without re-downloading and keeps the load non-render-blocking.
const preloadedStyles = document.querySelectorAll('link[rel="preload"][as="style"]');
preloadedStyles.forEach(link => {
  link.rel = 'stylesheet';
});
