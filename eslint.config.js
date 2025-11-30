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

  // JavaScript files - main source code
  {
    files: ['**/*.js'],
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

  // Prettier - only for JS files, HTML uses its own formatting
  {
    files: ['**/*.js'],
    ...prettierRecommended,
  },
]);
