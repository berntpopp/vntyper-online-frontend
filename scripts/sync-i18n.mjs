#!/usr/bin/env node
// Generates the translated site: /<locale>/<page> for every locale and page in
// i18n/config.json, from the English pages at the repo root.
//
// Translations are keyed by the English source text (gettext style) in
// i18n/<locale>.json, so the English HTML carries no i18n markup. A string
// with no translation stays English and is reported.
//
//   node scripts/sync-i18n.mjs            write everything
//   node scripts/sync-i18n.mjs --check    fail if output is stale or strings are untranslated
//   node scripts/sync-i18n.mjs --extract  print every English source string as JSON
//
// Adding a language: add it to i18n/config.json, add i18n/<code>.json, add
// the directory to the Dockerfile COPY list, run this script.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const extract = process.argv.includes('--extract');

const read = name => readFileSync(join(root, name), 'utf8');
const cfg = JSON.parse(read('i18n/config.json'));
const locales = Object.keys(cfg.locales);
const names = { [cfg.source.code]: cfg.source.name, ...cfg.locales };
const { version } = JSON.parse(read('package.json'));

/** Public URL path of a page in a language ('' prefix for the source language). */
const pagePath = (lang, page) =>
  `${lang === cfg.source.code ? '' : `/${lang}`}/${page === 'index.html' ? '' : page}`;

// --- generated regions --------------------------------------------------------
// The hreflang cluster and the language switcher depend on config, so they are
// generated into marked regions of the source pages (and of sitemap.xml) too.

const region = (text, name, body, file) => {
  const pattern = new RegExp(`(<!-- i18n:${name} -->)[\\s\\S]*?([ \\t]*<!-- /i18n:${name} -->)`);
  if (!pattern.test(text)) throw new Error(`${file}: missing <!-- i18n:${name} --> region`);
  return text.replace(pattern, (_, open, close) => `${open}\n${body}\n${close}`);
};

const alternates = (lang, page) =>
  [...Object.keys(names), 'x-default']
    .map(code => {
      const target = code === 'x-default' ? cfg.source.code : code;
      return `  <link rel="alternate" hreflang="${code}" href="${cfg.origin}${pagePath(target, page)}">`;
    })
    // lang.js reads the links above, so it must follow them.
    .concat(`  <script src="resources/js/lang.js?v=${version}"></script>`)
    // Runtime strings for resources/js/i18n.js. Deferred scripts run in document
    // order ahead of the modules below, without blocking the first paint.
    .concat(
      lang === cfg.source.code
        ? []
        : `  <script src="/${lang}/strings.js?v=${version}" defer></script>`
    )
    .join('\n');

const switcher = (current, page) => {
  const links = Object.entries(names)
    .map(([lang, name]) => {
      const here = lang === current ? ' aria-current="true"' : '';
      return `            <li><a href="${pagePath(lang, page)}" lang="${lang}" hreflang="${lang}"${here}>${name}</a></li>`;
    })
    .join('\n');
  return `        <details class="lang-switch" translate="no">
          <summary aria-label="Language: ${names[current]}">
            <span lang="${current}">${current.toUpperCase()}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </summary>
          <ul>
${links}
          </ul>
        </details>`;
};

const withRegions = (html, lang, page) =>
  region(
    region(html, 'alternates', alternates(lang, page), page),
    'switcher',
    switcher(lang, page),
    page
  );

// --- translatable units -------------------------------------------------------

const INLINE = new Set('a abbr b br code em i kbd mark small span strong sub sup u wbr'.split(' '));
const SKIP = new Set(['script', 'style', 'pre', 'template']);
const ATTRS = ['alt', 'title', 'placeholder', 'aria-label', 'data-tooltip', 'data-intro'];
const META = /^(description|keywords|twitter:title|twitter:description|og:title|og:description)$/;
const LD_KEYS = new Set(['description', 'text', 'keywords', 'featureList', 'headline']);

const norm = text => text.replace(/\s+/g, ' ').trim();
const inlineOnly = el => [...el.querySelectorAll('*')].every(child => INLINE.has(child.localName));

/**
 * Every translatable string of a document as { get, set } accessors: text
 * blocks (innerHTML when the block holds only inline markup, otherwise each
 * bare text node), text-bearing attributes, meta content and JSON-LD prose.
 */
function* units(doc) {
  const walk = function* (el) {
    if (SKIP.has(el.localName) || el.getAttribute('translate') === 'no') return;
    const texts = [...el.childNodes].filter(n => n.nodeType === 3 && norm(n.data));
    if (texts.length && inlineOnly(el)) {
      yield { get: () => el.innerHTML, set: v => (el.innerHTML = v) };
      return;
    }
    for (const node of texts) {
      // Keep the surrounding whitespace so inline neighbours do not collide.
      const [, lead, trail] = /^(\s*)[\s\S]*?(\s*)$/.exec(node.data);
      yield { get: () => node.data, set: v => (node.data = lead + v + trail) };
    }
    for (const child of el.children) yield* walk(child);
  };
  yield* walk(doc.documentElement);

  // After the text: a translated block replaces its inline children, attributes included.
  for (const el of doc.querySelectorAll(ATTRS.map(attr => `[${attr}]`).join(','))) {
    if (el.closest('[translate="no"]')) continue;
    for (const attr of ATTRS) {
      if (norm(el.getAttribute(attr) ?? '')) {
        yield { get: () => el.getAttribute(attr), set: v => el.setAttribute(attr, v) };
      }
    }
  }

  for (const meta of doc.querySelectorAll('meta[content]')) {
    if (META.test(meta.getAttribute('name') ?? meta.getAttribute('property') ?? '')) {
      yield { get: () => meta.content, set: v => (meta.content = v) };
    }
  }
}

/** Translates prose values of a JSON-LD tree in place; names stay unless they are questions. */
const translateLd = (node, t) => {
  if (Array.isArray(node)) return node.forEach(item => translateLd(item, t));
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    const prose = LD_KEYS.has(key) || (key === 'name' && node['@type'] === 'Question');
    if (prose && typeof value === 'string') node[key] = t(value);
    else if (prose && Array.isArray(value))
      node[key] = value.map(v => (typeof v === 'string' ? t(v) : v));
    else translateLd(value, t);
  }
};

// --- one page in one language -------------------------------------------------

const isPage = file => cfg.pages.includes(file);

/** Points a URL written for the root page at the right place from /<lang>/. */
const relocate = (url, lang) => {
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url) || url === '') return url;
  const [, path, rest] = /^([^?#]*)(.*)$/.exec(url);
  if (path.startsWith('/')) {
    const file = path.slice(1) || 'index.html';
    return isPage(file) ? pagePath(lang, file) + rest : url;
  }
  // './' is the language's own home page; everything else relative is a shared asset.
  return isPage(path) || path === './' ? url : `/${url}`;
};

function render(page, lang, catalogue, missing) {
  const dom = new JSDOM(withRegions(read(page), lang, page));
  const doc = dom.window.document;
  const t = source => {
    const id = norm(source);
    if (catalogue[id]) return catalogue[id];
    missing.add(id);
    return source;
  };

  for (const unit of units(doc)) unit.set(t(unit.get()));
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const data = JSON.parse(script.textContent);
    translateLd(data, t);
    data.inLanguage = lang;
    script.textContent = `\n${JSON.stringify(data, null, 2)}\n`;
  }

  doc.documentElement.lang = lang;
  for (const el of doc.querySelectorAll('[href], [src]')) {
    const attr = el.hasAttribute('href') ? 'href' : 'src';
    if (el.getAttribute('rel') === 'alternate' || el.closest('.lang-switch')) continue;
    el.setAttribute(attr, relocate(el.getAttribute(attr), lang));
  }
  for (const el of doc.querySelectorAll('[srcset]')) {
    const candidates = el.getAttribute('srcset').split(',');
    el.setAttribute('srcset', candidates.map(c => relocate(c.trim(), lang)).join(', '));
  }
  const self = cfg.origin + pagePath(lang, page);
  doc.querySelector('link[rel="canonical"]')?.setAttribute('href', self);
  doc.querySelector('meta[property="og:url"]')?.setAttribute('content', self);
  return `${dom.serialize()}\n`;
}

// --- runtime strings ----------------------------------------------------------
// Every t('...') call in resources/js. The argument must be a plain literal.

const jsFiles = dir =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return jsFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });

const CALL = /(?<![\w.$])t\(/g;
const LITERAL = /(?<![\w.$])t\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")\s*[,)]/g;

const runtimeIds = new Set();
for (const file of jsFiles('resources/js')) {
  if (file === 'resources/js/i18n.js') continue;
  const source = read(file);
  const literals = [...source.matchAll(LITERAL)];
  const calls = source.match(CALL)?.length ?? 0;
  if (literals.length !== calls) {
    throw new Error(`${file}: ${calls - literals.length} t() call(s) without a string literal`);
  }
  for (const [, single, double] of literals) {
    runtimeIds.add((single ?? double).replace(/\\(['"\\])/g, '$1'));
  }
}

// --- run ----------------------------------------------------------------------

if (extract) {
  const all = new Set();
  for (const page of cfg.pages) render(page, cfg.source.code, {}, all);
  for (const id of runtimeIds) all.add(id);
  process.stdout.write(
    `${JSON.stringify(Object.fromEntries([...all].map(id => [id, ''])), null, 2)}\n`
  );
  process.exit(0);
}

/** @type {Map<string, string>} */
const outputs = new Map();
const problems = [];

for (const page of cfg.pages) outputs.set(page, withRegions(read(page), cfg.source.code, page));

for (const lang of locales) {
  const catalogue = JSON.parse(read(`i18n/${lang}.json`));
  const missing = new Set();
  for (const page of cfg.pages)
    outputs.set(`${lang}/${page}`, render(page, lang, catalogue, missing));
  const strings = {};
  for (const id of runtimeIds) {
    if (catalogue[id]) strings[id] = catalogue[id];
    else missing.add(id);
  }
  outputs.set(`${lang}/strings.js`, `window.I18N = ${JSON.stringify(strings, null, 2)};\n`);
  if (missing.size) {
    problems.push(
      `${lang}: ${missing.size} untranslated string(s), e.g. "${[...missing][0].slice(0, 70)}"`
    );
  }
}

// Sitemap: one entry per translated page, dated like its English source.
const sitemap = read('sitemap.xml');
const lastmod = page =>
  new RegExp(`<loc>${cfg.origin}${pagePath(cfg.source.code, page)}</loc>\\s*<lastmod>([^<]+)`).exec(
    sitemap
  )?.[1];
const entries = locales.flatMap(lang =>
  cfg.pages.map(
    page =>
      `  <url>\n    <loc>${cfg.origin}${pagePath(lang, page)}</loc>\n` +
      (lastmod(page) ? `    <lastmod>${lastmod(page)}</lastmod>\n` : '') +
      `  </url>`
  )
);
outputs.set('sitemap.xml', region(sitemap, 'locales', entries.join('\n'), 'sitemap.xml'));

for (const [file, content] of outputs) {
  const path = join(root, file);
  if (existsSync(path) && readFileSync(path, 'utf8') === content) continue;
  if (check) problems.push(`${file} is stale - run: node scripts/sync-i18n.mjs`);
  else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(`wrote ${file}`);
  }
}

for (const problem of problems) console.error(`i18n: ${problem}`);
if (check && problems.length) process.exit(1);
