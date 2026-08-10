#!/usr/bin/env node
// Keeps the version string in sync across the three places it lives:
// package.json (the source of truth), resources/js/version.js, and the ?v=
// cache-busters in index.html.
//
// Run with --check in CI to fail on drift. Commit 1799d05 ("fix: update
// hardcoded version constant to 0.65.1") is what this prevents.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const targets = [
  {
    path: 'resources/js/version.js',
    pattern: /(const frontendVersion = ')(\d+\.\d+\.\d+)(')/g,
  },
  {
    path: 'index.html',
    pattern: /(\?v=)(\d+\.\d+\.\d+)()/g,
  },
];

let drifted = false;

for (const target of targets) {
  const file = join(root, target.path);
  const before = readFileSync(file, 'utf8');

  const found = [...before.matchAll(target.pattern)];
  if (found.length === 0) {
    console.error(`ERROR: no version string found in ${target.path}`);
    process.exit(1);
  }

  const after = before.replace(target.pattern, (_match, prefix, _old, suffix) =>
    [prefix, version, suffix].join('')
  );

  if (before === after) {
    continue;
  }

  drifted = true;
  const stale = [...new Set(found.map(match => match[2]))].join(', ');

  if (check) {
    console.error(`DRIFT: ${target.path} has ${stale}, expected ${version}`);
  } else {
    writeFileSync(file, after);
    console.log(`updated ${target.path}: ${stale} -> ${version}`);
  }
}

if (check && drifted) {
  console.error('\nRun `npm run version:sync` to fix.');
  process.exit(1);
}

console.log(check ? `version ${version} is in sync` : `version ${version} synced`);
