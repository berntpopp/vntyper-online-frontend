# Makefile for vntyper-online-frontend
# Run these commands locally before committing

.PHONY: help install lint lint-fix format format-check test test-coverage check pre-commit audit clean

# Default target
help:
	@echo "Available commands:"
	@echo "  make install       - Install npm dependencies"
	@echo "  make lint          - Run ESLint"
	@echo "  make lint-fix      - Run ESLint with auto-fix"
	@echo "  make format        - Format code with Prettier"
	@echo "  make format-check  - Check formatting without changes"
	@echo "  make test          - Run tests in watch mode"
	@echo "  make test-run      - Run tests once"
	@echo "  make test-coverage - Run tests with coverage"
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

# Testing
test:
	npm run test

test-run:
	npm run test:run

test-coverage:
	npm run test:coverage

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
pre-commit: format lint-fix test-run audit
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
