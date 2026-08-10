#!/usr/bin/env node
// Keeps the version string in sync across every place it lives:
//   - package.json          the source of truth
//   - package-lock.json     root packages entry, updated by `npm version`
//   - resources/js/version.js   the constant shown in the footer
//   - index.html            ?v= cache-busters on every local module
//
// Run with --check in CI to fail on drift. Commit 1799d05 ("fix: update
// hardcoded version constant to 0.65.1") is what this prevents.
//
// The invariant for index.html is deliberately stronger than "some ?v= exists":
// EVERY <script src="resources/js/....js"> must carry ?v=<version>. A weaker
// check passes when cache-busters are deleted or a new module is added without
// one, which is exactly how this drifts in practice.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const read = name => readFileSync(join(root, name), 'utf8');
const { version } = JSON.parse(read('package.json'));

/** @type {string[]} */
const problems = [];
/** @type {[string, string][]} */
const writes = [];

// --- package-lock.json ------------------------------------------------------
// `npm version` updates this, but a hand-edited package.json does not.
const lock = JSON.parse(read('package-lock.json'));
if (lock.version !== version) {
  problems.push(`package-lock.json declares ${lock.version}, expected ${version}`);
}
if (lock.packages?.['']?.version && lock.packages[''].version !== version) {
  problems.push(
    `package-lock.json root package declares ${lock.packages[''].version}, expected ${version}`
  );
}

// --- resources/js/version.js ------------------------------------------------
const versionJsPath = 'resources/js/version.js';
const versionJs = read(versionJsPath);
const constPattern = /(const frontendVersion = ')([^']+)(')/g;
const constMatches = [...versionJs.matchAll(constPattern)];

if (constMatches.length !== 1) {
  problems.push(
    `${versionJsPath}: expected 1 frontendVersion declaration, found ${constMatches.length}`
  );
} else if (constMatches[0][2] !== version) {
  problems.push(`${versionJsPath}: frontendVersion is ${constMatches[0][2]}, expected ${version}`);
  writes.push([versionJsPath, versionJs.replace(constPattern, `$1${version}$3`)]);
}

// --- index.html -------------------------------------------------------------
const htmlPath = 'index.html';
const html = read(htmlPath);

// Every <script> pointing at a local module, whether or not it is versioned.
const scriptPattern = /(<script\b[^>]*\bsrc=")(resources\/js\/[^"?]+\.js)(\?v=[^"]*)?(")/g;
const scripts = [...html.matchAll(scriptPattern)];

if (scripts.length === 0) {
  problems.push(`${htmlPath}: no local module <script> tags found - has the markup changed?`);
}

const stale = scripts.filter(match => match[3] !== `?v=${version}`);
for (const match of stale) {
  problems.push(
    `${htmlPath}: ${match[2]} has ${match[3] ? match[3].slice(1) : 'no cache-buster'}, expected v=${version}`
  );
}

if (stale.length > 0) {
  writes.push([
    htmlPath,
    html.replace(
      scriptPattern,
      (_m, open, path, _old, close) => `${open}${path}?v=${version}${close}`
    ),
  ]);
}

// --- report -----------------------------------------------------------------
if (problems.length === 0) {
  console.log(`version ${version} is in sync across ${scripts.length} modules`);
  process.exit(0);
}

if (check) {
  for (const problem of problems) {
    console.error(`DRIFT: ${problem}`);
  }
  console.error('\nRun `npm run version:sync` to fix.');
  process.exit(1);
}

const unwritable = problems.filter(p => p.startsWith('package-lock.json'));
for (const [path, contents] of writes) {
  writeFileSync(join(root, path), contents);
  console.log(`updated ${path}`);
}
for (const problem of unwritable) {
  console.error(`MANUAL FIX NEEDED: ${problem} (run \`npm install\` to refresh the lockfile)`);
}

process.exit(unwritable.length > 0 ? 1 : 0);
