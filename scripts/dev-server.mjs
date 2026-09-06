#!/usr/bin/env node
// Zero-dependency static file server for local development and Playwright.
//
// Port 3000 is not arbitrary: resources/js/config.js switches API_URL to
// http://localhost:8000/api when window.location.port === '3000', and to the
// relative /api otherwise. Serving on another port silently changes which
// backend the app talks to.
//
// This is a DEVELOPMENT server. Production is stock nginx (see Dockerfile), so
// it does not reproduce production headers. It does reproduce production's WEB
// ROOT: the Dockerfile COPYs an allow-list, not the repository, so serving the
// whole tree here would let a developer load a file that 404s in production -
// and would hand out package.json and the test suite on localhost. The
// allow-list below is the same rule the Dockerfile applies.

import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname, sep } from 'node:path';

const root = await realpath(join(dirname(fileURLToPath(import.meta.url)), '..'));
const port = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// Mirrors the Dockerfile's COPY allow-list. Keep the two in step: a file that
// production serves must be reachable here, and nothing else should be.
const SERVED_FILES = new Set([
  'index.html',
  'adtkd_diagnostics.html',
  'contact.html',
  'impressum_en.html',
  'impressum_de.html',
  'donate.html',
  'robots.txt',
  'sitemap.xml',
]);
const SERVED_DIRS = ['resources'];

// Mirrors .dockerignore: these never reach the image, so they must not be
// reachable here either, or a developer can load a file production will 404.
const EXCLUDED = /(^|\/)(_original\/|.*\.(backup|bak|orig|log|tmp|swp)$)/;

/**
 * Is this repo-relative path one that production would serve?
 *
 * @param {string} relative Path relative to the repository root, POSIX style
 * @returns {boolean}
 */
function isServable(relative) {
  if (SERVED_FILES.has(relative)) {
    return true;
  }
  return SERVED_DIRS.some(dir => relative === dir || relative.startsWith(`${dir}/`));
}

/**
 * Resolve a request path to a real file inside the repository root.
 *
 * Containment is checked after realpath() so a symlink pointing outside the
 * root cannot be followed - a plain string-prefix check on the unresolved path
 * would miss that.
 *
 * @param {string} urlPath Decoded pathname, query already stripped
 * @returns {Promise<string|null>} Absolute file path, or null if not servable
 */
async function resolveFile(urlPath) {
  let candidate = resolve(root, `.${urlPath}`);

  let info;
  try {
    info = await stat(candidate);
  } catch {
    return null;
  }

  if (info.isDirectory()) {
    candidate = join(candidate, 'index.html');
    try {
      await stat(candidate);
    } catch {
      return null;
    }
  }

  const real = await realpath(candidate).catch(() => null);
  if (!real || !real.startsWith(root + sep)) {
    return null;
  }

  const relative = real
    .slice(root.length + 1)
    .split(sep)
    .join('/');

  if (EXCLUDED.test(relative) || !isServable(relative)) {
    return null;
  }

  return real;
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method Not Allowed');
    return;
  }

  let pathname;
  try {
    // Strips the ?v= cache-buster and any other query string.
    pathname = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname);
  } catch {
    res.writeHead(400).end('Bad Request');
    return;
  }

  const file = await resolveFile(pathname);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
    return;
  }

  const headers = {
    'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
    // Never cache in development: the ?v= busters are for production.
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };

  if (req.method === 'HEAD') {
    res.writeHead(200, headers).end();
    return;
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, headers).end(body);
  } catch {
    res.writeHead(500).end('Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`serving ${root} on http://localhost:${port}`);
});
