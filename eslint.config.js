// eslint.config.js - ESLint 9 Flat Config for vanilla JavaScript frontend
import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import html from '@html-eslint/eslint-plugin';
import htmlParser from '@html-eslint/parser';

export default defineConfig([
  // Global ignores - these patterns are excluded from all linting
  globalIgnores([
    'node_modules/',
    'coverage/',
    '.playwright-mcp/',
    'plan/',
    '**/*.min.js',
    '**/*.min.css',
    'package-lock.json',
  ]),

  // JavaScript files - main source code.
  // .mjs is listed explicitly: eslint enumerates .mjs by default but a
  // `**/*.js` block does not match it, so tooling scripts were being reported
  // as "linted" while no rule actually applied to them.
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // Project-specific globals
        CONFIG: 'readonly',
        Aioli: 'readonly',
        introJs: 'readonly',
      },
    },
    rules: {
      // Error prevention - warn initially for easier adoption
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-undef': 'error',
      'no-console': 'warn',

      // New in ESLint 10 recommended set - warn during adoption (see no-unused-vars rationale).
      // no-useless-assignment flags defensive default initializers; preserve-caught-error wants
      // error-cause chaining. Both deferred to a dedicated cleanup PR to keep dependency bumps focused.
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',

      // Security-related rules (browser-safe subset)
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // Best practices
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-return-await': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-prototype-builtins': 'warn',

      // Size limit. Above roughly this, a file stops fitting in an agent's
      // working context alongside its dependencies, and edits get less
      // reliable. Measured on effective lines - blanks and comments do not
      // count. Tests are exempt below. See AGENTS.md.
      'max-lines': ['error', { max: 650, skipBlankLines: true, skipComments: true }],

      // Code quality
      curly: ['error', 'all'],
      'default-case': 'warn',
      'no-fallthrough': 'error',
      'no-useless-escape': 'warn',

      // ES6+ best practices
      'prefer-template': 'off', // Too noisy for existing codebase
      'no-duplicate-imports': 'error',
      'object-shorthand': 'off', // Too noisy for existing codebase

      // Async/Promise best practices
      'no-async-promise-executor': 'error',
      'require-atomic-updates': 'warn',
      'no-promise-executor-return': 'warn',

      // Disabled - handled by Prettier
      'arrow-body-style': 'off',
      'prefer-arrow-callback': 'off',
    },
  },

  // Test files - Vitest environment
  {
    files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js', 'vitest.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        // Vitest globals (matches vitest.config.js globals: true)
        vi: 'readonly',
        vitest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        suite: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'error',
      // Long, explicit tests are correct; nine test files exceed 650 lines.
      'max-lines': 'off',
      // Relax unused vars for test files - mocks often have unused params
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_|^event$|^handler$|^options$|^config$|^e$|^error$',
          varsIgnorePattern: '^_|^controller$',
          caughtErrorsIgnorePattern: '^_|^e$|^error$',
        },
      ],
    },
  },

  // HTML files - accessibility and best practices
  {
    files: ['**/*.html'],
    plugins: {
      '@html-eslint': html,
    },
    languageOptions: {
      parser: htmlParser,
    },
    rules: {
      // Accessibility
      '@html-eslint/require-lang': 'error',
      '@html-eslint/require-title': 'error',
      '@html-eslint/no-duplicate-id': 'error',
      '@html-eslint/require-img-alt': 'error',
      '@html-eslint/no-accesskey-attrs': 'warn',

      // SEO
      '@html-eslint/require-meta-charset': 'error',
      '@html-eslint/require-meta-viewport': 'error',
      '@html-eslint/require-meta-description': 'warn',

      // Security
      '@html-eslint/no-target-blank': 'error',

      // Best Practices
      '@html-eslint/no-duplicate-attrs': 'error',
      '@html-eslint/require-doctype': 'error',
      '@html-eslint/no-obsolete-tags': 'error',
      // HTML5 doesn't require self-closing for void elements
      '@html-eslint/require-closing-tags': 'off',
      '@html-eslint/no-extra-spacing-attrs': 'off', // Allow flexible attribute spacing

      // Disabled for flexibility - handled by Prettier or project style
      '@html-eslint/indent': 'off',
      '@html-eslint/quotes': 'off',
      '@html-eslint/element-newline': 'off',
      '@html-eslint/no-trailing-spaces': 'off',
    },
  },

  // Legacy oversized module. A blanket eslint-disable would let this file grow
  // without limit, which is the opposite of the point; pin it to its current
  // size instead so it can only shrink. Ratchet this number down as logic is
  // extracted, and delete the block once it passes the 650 default.
  //
  // bamProcessing.js mixes Aioli/samtools orchestration, reference assembly
  // detection and region extraction - three responsibilities. TODO(split).
  // Do not add to it; see the dual-generation rule in AGENTS.md.
  {
    files: ['resources/js/bamProcessing.js'],
    rules: {
      // 906, not the exact current count: a ceiling with zero headroom forces
      // contortions like cramming a JSDoc cast onto one line to dodge
      // Prettier's wrap. Two lines of slack keep normal formatting possible
      // while still capping growth at roughly today's size.
      'max-lines': ['error', { max: 906, skipBlankLines: true, skipComments: true }],
    },
  },

  // Node tooling - build scripts and config files run under Node, not the
  // browser, so they need Node globals and must not inherit browser ones.
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.js', '*.config.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Tooling scripts report progress on stdout; that is their interface.
      'no-console': 'off',
    },
  },

  // Prettier - only for JS files, HTML uses its own formatting
  {
    files: ['**/*.js', '**/*.mjs'],
    ...prettierRecommended,
  },
]);
