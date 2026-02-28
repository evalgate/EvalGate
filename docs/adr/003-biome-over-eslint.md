# ADR-003: Use Biome over ESLint + Prettier

**Status:** Accepted
**Date:** 2026-02-28
**Decision makers:** Paul Cavallo

## Context

The project originally used ESLint for linting and Prettier for formatting — a common combination in the JavaScript/TypeScript ecosystem. However, this setup required maintaining two separate configurations, resolving conflicts between ESLint and Prettier rules (via `eslint-config-prettier`), and managing a large dependency tree of ESLint plugins (`@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-import`, etc.).

CI lint checks with ESLint were taking 15–20 seconds on the full codebase, and developers frequently encountered configuration drift between their local setup and CI.

## Decision

We replaced ESLint + Prettier with Biome, a unified linter and formatter written in Rust. A single `biome.json` configuration file handles both linting and formatting rules. Biome runs as a single binary with no plugin system to manage.

## Consequences

**Easier:**
- Single configuration file (`biome.json`) replaces `.eslintrc`, `.prettierrc`, and associated ignore files.
- 10–50x faster execution than ESLint + Prettier due to Rust implementation and parallel processing.
- No dependency tree to manage — Biome is a single dev dependency.
- Consistent formatting is enforced without ESLint/Prettier rule conflicts.
- IDE integration via the Biome VS Code extension provides real-time feedback identical to CI.

**More difficult:**
- Biome does not support the full breadth of ESLint plugins. Some niche rules (e.g., `eslint-plugin-jsx-a11y` edge cases) are not yet covered.
- Developers accustomed to ESLint's plugin ecosystem need to verify Biome rule equivalents.
- Custom lint rules require waiting for upstream Biome support rather than writing an ESLint plugin.
