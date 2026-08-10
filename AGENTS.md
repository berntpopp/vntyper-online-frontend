# AGENTS.md

Instructions for AI coding agents working in this repository. This is the single
source of truth; `CLAUDE.md` only points here.

## What this is

VNtyper Online — a browser-based MUC1 VNTR genotyping tool for ADTKD screening.
It runs `samtools` in the browser via BioWasm's Aioli (WebAssembly), extracts a
region from user BAM files locally, and submits only that subset to the VNtyper
API. **There is no build step.** The `.js` files in `resources/js/` are served
directly to the browser by nginx as native ES modules.

## Commands

| Task       | Command                               |
| ---------- | ------------------------------------- |
| Install    | `npm ci`                              |
| Dev server | `make dev` (port 3000 — see below)    |
| Lint       | `npm run lint:fix`                    |
| Format     | `npm run format`                      |
| Typecheck  | `npm run typecheck`                   |
| Unit tests | `npm run test:run`                    |
| E2E tests  | `npm run test:e2e`                    |
| **Gate**   | `npm run check` — must pass to commit |
| Everything | `npm run test:all`                    |

## Architecture

```
resources/js/
  controllers/   AppController, JobController, CohortController,
                 FileController, ExtractionController, BaseController
  views/         JobView, CohortView, ErrorView
  models/        Job, Cohort
  services/      APIService, httpUtils
  utils/         EventBus, DI (container), safeStorage
  *.js           legacy flat modules (bamProcessing, stateManager, uiUtils,
                 apiInteractions, log, modal, …)
  main.js        wires both generations together via the DI container
```

**The dual-generation rule.** Two generations of code coexist. New code goes in
the MVC layer: `controllers/`, `views/`, `models/`, `services/`, `utils/`. Never
extend a legacy flat module in `resources/js/*.js`. When you must change one,
extract the changed logic into the modern layer and call it from the old file.

## Hard rules

1. **650 lines per file** in `resources/js/**`, counting neither blanks nor
   comments. Enforced by ESLint `max-lines`. Split before you approach it.
   `tests/**` is exempt — long explicit tests are correct.
2. **JSDoc `@param` and `@returns` on every exported function.** The typecheck
   reads them; they are not decoration.
3. **`npm run check` must pass before you commit.** It runs version sync, lint
   at zero warnings, format, and typecheck.
4. **No inline `<script>` blocks and no `on*=` attribute handlers.** A Content
   Security Policy is enforced at deploy time from outside this repository, so
   nothing here will catch the violation locally — but production will break.
   Commit `062711b` is one of these reaching users.
5. **CDN assets need `integrity` and a pinned version.** Commit `0438aac` is an
   unpinned biowasm URL taking the app down.
6. **Never add a build step, bundler, or `.ts` source file.** TypeScript is
   configured `noEmit` and is used only to check the existing JSDoc.

## Conventions

- **Commits:** Conventional Commits — `type(scope): subject`. Types in use:
  `feat`, `fix`, `chore`, `docs`, `style`, `test`, `build`, `ci`.
- **Naming:** camelCase for legacy flat modules (`bamProcessing.js`),
  PascalCase for classes in the MVC layer (`JobController.js`).
- **Cache busting:** every module in `index.html` carries `?v=<version>`.
  Never edit these by hand; see the release ritual.

## Release ritual

The version string lives in three places. Keeping them in sync is automated —
do not edit `version.js` or the `?v=` strings by hand.

```bash
npm version patch     # or minor / major — updates package.json
npm run version:sync  # rewrites resources/js/version.js and index.html
```

`npm run version:check` fails the build on drift and runs in CI. Commit
`1799d05` is what this prevents.

## Gotchas

- **`window.CONFIG` only exists on `index.html`.** `config.js` is loaded by that
  page alone; the other four pages load `version.js` without it. Never read
  `window.CONFIG` at module scope — read it inside a function and guard it.
  Commit `d8b9ddd` is this bug.
- **The dev server must be port 3000.** `config.js` switches `API_URL` to
  `http://localhost:8000/api` when `window.location.port === '3000'`, and to the
  relative `/api` otherwise. Another port silently changes behavior.
- **A disclaimer modal blocks the page on first load** until the cookie
  `disclaimerAcknowledged=true` is set. E2E tests set it via the fixture in
  `tests/e2e/fixtures/api.js`.
- **`Aioli` and `introJs` are CDN globals**, not imports. They are declared in
  `types/globals.d.ts`; extend that file rather than casting to `any`.
- **Adding a file the site must serve?** Update the `COPY` allowlist in
  `Dockerfile` _and_ the served-paths list in
  `.github/workflows/docker-content.yml`. That workflow fails otherwise.
- **Adding a root-level tooling file?** Update `.dockerignore` _and_ the
  "must not be served" list in the same workflow. It is the guard that keeps
  source out of the web root.
- **`strict: true` in `tsconfig.json` is the next planned ratchet.** It is off
  today because enabling it adds several hundred errors. Do not turn it on as a
  side effect of another change.

## Testing

- **Unit** — Vitest with jsdom, in `tests/unit/`, mirroring the source layout.
  Do not reach for the DOM when a pure function will do.
- **E2E** — Playwright in `tests/e2e/`, against the local dev server with the
  backend stubbed through `page.route()`. Tests are hermetic and run offline.
  An unmocked request fails the test loudly instead of hanging.
- Never lower a coverage threshold or delete an assertion to make a suite pass.
