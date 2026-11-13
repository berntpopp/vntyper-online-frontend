# Development

The project rules (architecture, hard limits, release ritual, translations) live
in [AGENTS.md](../AGENTS.md). This page covers running and testing the site.

## Technologies

- **HTML5 and CSS3** for the pages and styling.
- **JavaScript (ES modules)** for file handling, processing logic and user
  interaction, served to the browser without a build step.
- **[BioWasm's Aioli](https://www.biowasm.com/)** to run `samtools` in the
  browser.
- **[samtools](http://www.htslib.org/)** for working with high-throughput
  sequencing data.

## Running locally

```bash
git clone https://github.com/vntyper-org/vntyper-online-frontend.git
cd vntyper-online-frontend
npm ci
make dev            # or: node scripts/dev-server.mjs
```

The site is served at <http://localhost:3000>.

Port 3000 is required, not a preference: `resources/js/config.js` points the
app at a local backend only when the page is served on that port. The dev
server also mirrors production's web root, so a file that 404s in production
404s here too.

To develop with the browser cache disabled, open DevTools (F12), check
**Disable cache** on the Network tab, and keep DevTools open while you work.

## Testing

Unit tests use **Vitest** with **jsdom**; end-to-end tests use **Playwright**.

```bash
npm ci                  # install dependencies
npm test                # run tests in watch mode
npm run test:run        # run tests once (CI mode)
npm run test:coverage   # run with a coverage report
npm run test:watch      # watch mode
npm run test:ui         # Vitest UI
```

### Test layout

```text
tests/
├── unit/                    # Vitest unit tests, mirroring the source layout
│   ├── controllers/         # Controller tests
│   ├── services/            # Service tests (APIService, httpUtils)
│   ├── utils/               # Utility tests (EventBus, DI, stateManager)
│   └── views/               # View tests
└── e2e/                     # Playwright end-to-end tests
    └── fixtures/            # Backend stubs and shared helpers
```

### Coverage

- **When the floor was last set:** 602 tests across 19 files; 33.5% statements, 31.0% branches,
  41.9% functions, 33.6% lines.
- **Enforced floor:** the `vitest.config.js` thresholds sit just under those
  numbers and run in CI, so coverage cannot regress. Raise them as tests are
  added; never lower them.
- **Target:** 60%. Getting there means covering the legacy flat modules, which
  are the bulk of the untested code.

### Writing tests

- **Plain JavaScript:** no TypeScript, no build step.
- **ES modules:** native `import`/`export`.
- **Vitest helpers:** `vi.fn()`, `vi.spyOn()`, `vi.useFakeTimers()`.
- **Structure:** tests mirror the application architecture.

```javascript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../../../resources/js/myModule.js';

describe('myFunction()', () => {
  it('should return expected result', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

`vitest.config.js` sets the `jsdom` environment, the `v8` coverage provider and
`globals: true` (so `describe`, `it` and `expect` are available everywhere).

### End-to-end tests

Playwright drives a real browser against the site served by
`scripts/dev-server.mjs`, with the backend API stubbed.

```bash
npx playwright install --with-deps chromium   # once
npm run test:e2e
npm run test:e2e:ui                           # interactive
```

Only the VNtyper backend is mocked. The CDN assets are not: intro.js and
BioWasm's Aioli are loaded with Subresource Integrity, so stubbing those
responses fails the hash check and breaks the page. The current suite still
passes with the CDNs unreachable, since those globals are only needed by the
tutorial and by extraction.

## Quality gates

```bash
npm run check      # version sync, translations, agent docs, lint (zero warnings), format, typecheck
npm run test:all   # unit and end-to-end tests
```

Both run in CI.
