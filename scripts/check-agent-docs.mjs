#!/usr/bin/env node
// Verifies that AGENTS.md tells the truth.
//
// Agent instruction files rot silently: they are prose, nothing executes them,
// and an agent that follows a command which no longer exists wastes a whole
// session. This asserts that every `npm run X`, `make X` and repository path
// named in AGENTS.md actually exists, and that the pointer files really point
// at it.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFileSync(join(root, name), 'utf8');

const doc = read('AGENTS.md');
/** @type {string[]} */
const problems = [];

// --- npm scripts ------------------------------------------------------------
const pkg = JSON.parse(read('package.json'));
const scripts = new Set(Object.keys(pkg.scripts ?? {}));

// [^`]* so a command written with arguments - `npm run test:e2e -- --ui` -
// is still checked rather than silently skipped.
for (const [, name] of doc.matchAll(/`npm run ([a-z0-9:-]+)[^`]*`/g)) {
  if (!scripts.has(name)) {
    problems.push(`AGENTS.md references \`npm run ${name}\`, which is not in package.json`);
  }
}

// --- make targets -----------------------------------------------------------
const makefile = read('Makefile');
const targets = new Set([...makefile.matchAll(/^([a-zA-Z][a-zA-Z0-9_-]*):/gm)].map(m => m[1]));

for (const [, name] of doc.matchAll(/`make ([a-z-]+)[^`]*`/g)) {
  if (!targets.has(name)) {
    problems.push(`AGENTS.md references \`make ${name}\`, which is not a Makefile target`);
  }
}

// --- repository paths -------------------------------------------------------
// Only check things that look like a real path with a directory or extension,
// so prose like `type(scope): subject` is not mistaken for one.
for (const [, path] of doc.matchAll(/`((?:resources|tests|scripts|types|\.github)\/[^`\s]+)`/g)) {
  // A glob such as resources/js/*.js asserts only that its directory exists.
  const clean = (path.includes('*') ? path.slice(0, path.indexOf('*')) : path).replace(/\/$/, '');
  if (!existsSync(join(root, clean))) {
    problems.push(`AGENTS.md references ${path}, which does not exist`);
  }
}

// --- root-level files -------------------------------------------------------
// Backticked bare filenames with a config-ish extension, e.g. `tsconfig.json`.
for (const [, name] of doc.matchAll(
  /`([A-Za-z0-9._-]+\.(?:json|mjs|cjs|md|yml|yaml|config\.js))`/g
)) {
  if (!existsSync(join(root, name))) {
    problems.push(`AGENTS.md references ${name}, which does not exist at the repository root`);
  }
}

// --- pointer files ----------------------------------------------------------
for (const pointer of ['CLAUDE.md', 'GEMINI.md']) {
  if (!existsSync(join(root, pointer))) {
    problems.push(`${pointer} is missing; AGENTS.md claims it points here`);
    continue;
  }
  if (!read(pointer).includes('@AGENTS.md')) {
    problems.push(`${pointer} does not import @AGENTS.md, so the two can drift`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`STALE: ${problem}`);
  }
  console.error(`\n${problems.length} problem(s). Fix AGENTS.md or add the missing command.`);
  process.exit(1);
}

console.log('AGENTS.md is consistent with the repository');
