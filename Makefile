# Makefile for vntyper-online-frontend
# Run these commands locally before committing

.PHONY: help install dev lint lint-fix format format-check typecheck test test-run test-coverage e2e check test-all pre-commit audit clean quick-check

# Default target
help:
	@echo "Available commands:"
	@echo "  make install       - Install npm dependencies"
	@echo "  make dev           - Serve the site on http://localhost:3000"
	@echo "  make lint          - Run ESLint"
	@echo "  make lint-fix      - Run ESLint with auto-fix"
	@echo "  make format        - Format code with Prettier"
	@echo "  make format-check  - Check formatting without changes"
	@echo "  make typecheck     - Typecheck JSDoc with tsc --checkJs"
	@echo "  make test          - Run tests in watch mode"
	@echo "  make test-run      - Run tests once"
	@echo "  make test-coverage - Run tests with coverage"
	@echo "  make e2e           - Run Playwright end-to-end tests"
	@echo "  make test-all      - Run unit + e2e tests"
	@echo "  make check         - Run lint + format check (CI simulation)"
	@echo "  make audit         - Run npm security audit"
	@echo "  make pre-commit    - Run all checks before committing"
	@echo "  make clean         - Clean build artifacts"
	@echo ""
	@echo "Recommended workflow before committing:"
	@echo "  make pre-commit"

# Install dependencies
install:
	npm ci

# Development server. Port 3000 is required: config.js keys dev mode off it.
dev:
	node scripts/dev-server.mjs

# Linting
lint:
	npm run lint

lint-fix:
	npm run lint:fix

# Formatting
format:
	npm run format

format-check:
	npm run format:check

# Typechecking
typecheck:
	npm run typecheck

# Testing
test:
	npm run test

test-run:
	npm run test:run

test-coverage:
	npm run test:coverage

e2e:
	npm run test:e2e

test-all:
	npm run test:all

# Combined checks (simulates CI)
check:
	npm run check

# Security audit
audit:
	@echo "Running npm security audit..."
	npm audit --audit-level=high || true
	@echo ""
	@echo "Checking for critical vulnerabilities (must pass)..."
	npm audit --audit-level=critical

# Pre-commit: run all checks
pre-commit: format lint-fix typecheck test-run audit
	@echo ""
	@echo "=========================================="
	@echo "Pre-commit checks completed!"
	@echo "=========================================="
	@echo "If all checks passed, you're ready to commit."

# Clean build artifacts
clean:
	rm -rf coverage/
	rm -rf node_modules/.cache/

# Quick check (lint + format only, no tests)
quick-check: lint format-check
	@echo "Quick check completed!"
