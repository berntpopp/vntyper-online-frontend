import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Use happy-dom for fast DOM simulation (alternative: jsdom)
    environment: 'happy-dom',

    // Global test APIs (describe, it, expect available everywhere)
    globals: true,

    // Timeout configuration (prevents hanging tests)
    testTimeout: 10000,        // 10s max per test
    hookTimeout: 10000,        // 10s max per hook (beforeEach, afterEach)
    teardownTimeout: 5000,     // 5s max for cleanup

    // Pool configuration for better performance in WSL
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true     // Run tests in single thread (helps in WSL)
      }
    },

    // Better reporting
    silent: false,             // Show console output
    reporters: ['default'],    // Use default reporter (faster than verbose)

    // Coverage configuration
    coverage: {
      provider: 'v8',  // Fast, native coverage
      reporter: ['text', 'json', 'html'],
      include: ['resources/js/**/*.js'],
      exclude: [
        'resources/js/main.js',  // Bootstrap file
        'resources/js/**/*.test.js',
        'resources/js/**/*.spec.js',
        'resources/js/tutorial.js',  // UI-only modules
        'resources/js/modal.js',
        'resources/js/footer.js',
        'resources/js/faq.js',
        'resources/js/disclaimer.js',
        'resources/js/userGuide.js',
        'resources/js/citations.js',
      ],
      // Target: 60-80% coverage
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60
      }
    },

    // Test file patterns
    include: ['**/*.{test,spec}.{js,mjs,cjs}'],

    // Watch mode excludes
    watchExclude: ['**/node_modules/**', '**/dist/**'],
  },
})
