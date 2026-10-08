// resources/js/i18n.js

/**
 * Translates a user-visible string set at runtime.
 *
 * The English text is the key. On a translated page /<locale>/strings.js has
 * filled window.I18N (see scripts/sync-i18n.mjs); on the English pages it is
 * absent and the text comes back unchanged. The first argument must be a plain
 * string literal - sync-i18n.mjs collects them by scanning the source.
 *
 * @param {string} text English text, with {name} placeholders
 * @param {Record<string, string | number>} [vars] Values for the placeholders
 * @returns {string}
 */
export function t(text, vars = {}) {
  const template = window.I18N?.[text] ?? text;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}
