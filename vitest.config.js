import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use jsdom for stable DOM simulation (switched from happy-dom due to v20 async issues)
    environment: 'jsdom',

    // Global test APIs (describe, it, expect available everywhere)
    globals: true,

    // Timeout configuration (prevents hanging tests)
    testTimeout: 10000, // 10s max per test
    hookTimeout: 10000, // 10s max per hook (beforeEach, afterEach)
    teardownTimeout: 5000, // 5s max for cleanup

    // Pool configuration for better performance in WSL
    pool: 'threads',
    maxWorkers: 1, // Run tests in single worker (helps in WSL)

    // Better reporting
    silent: false, // Show console output
    reporters: ['default'], // Use default reporter (faster than verbose)

    // Coverage configuration
    coverage: {
      provider: 'v8', // Fast, native coverage
      // lcov is required: CI uploads coverage/lcov.info to Codecov, and
      // without this reporter that file was never generated, so the upload
      // silently did nothing.
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['resources/js/**/*.js'],
      exclude: [
        'resources/js/main.js', // Bootstrap file
        'resources/js/**/*.test.js',
        'resources/js/**/*.spec.js',
        'resources/js/tutorial.js', // UI-only modules
        'resources/js/modal.js',
        'resources/js/footer.js',
        'resources/js/faq.js',
        'resources/js/disclaimer.js',
        'resources/js/userGuide.js',
        'resources/js/citations.js',
      ],
      // These are a RATCHET FLOOR, not a target. They were set to 60 and never
      // enforced: CI ran `test:run`, which produces no coverage at all, and the
      // v8 reporter did not emit lcov, so the Codecov upload was uploading a
      // file that never existed. With coverage actually running, the real
      // numbers are statements 33.51, branches 31.02, functions 41.94,
      // lines 33.61.
      //
      // Set to the EXACT current values, not rounded down: a floor rounded to
      // the whole percent silently tolerates a real regression (five uncovered
      // functions dropped lines to 33.47 and still passed a floor of 33).
      // 60 remains the goal - raise these as tests are added, never lower them.
      thresholds: {
        lines: 33.61,
        functions: 41.94,
        branches: 31.02,
        statements: 33.51,
      },
    },

    // Test file patterns. tests/e2e/ is Playwright's - its .spec.js files import
    // @playwright/test and must not be collected by Vitest.
    include: ['tests/unit/**/*.{test,spec}.{js,mjs,cjs}'],
    exclude: ['**/node_modules/**', 'tests/e2e/**'],

    // Watch mode excludes
    watchExclude: ['**/node_modules/**', '**/dist/**'],
  },
});
