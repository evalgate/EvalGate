# Changelog

Platform and SDK releases. For detailed SDK changes, see [src/packages/sdk/CHANGELOG.md](src/packages/sdk/CHANGELOG.md).

## [1.9.1] - 2026-03-01

### Fixed
- Fix 7 cross-tenant IDOR vulnerabilities across API routes
- Fix SSE server killing all clients after 30s (lastPing never updated)
- Fix SSE stream TDZ crash on response variable
- Fix Redis outage taking down all endpoints (add in-memory fallback)
- Fix shared reports .run() crash (SQLite method on PostgreSQL)
- Fix raw error message disclosure in 500 responses
- Fix SameSite=None cookie weakening CSRF protection
- Fix OAuth provider crash when credentials not configured
- Fix logger crash on circular references
- Fix report-card metadata overwrite making totalCost always 0
- Align TypeScript SDK types with actual API response shapes (12+ fixes)
- Fix Python SDK CLI init template, run output, credential resolution
- Add rate limiting to demo playground, onboarding, billing-portal
- Add NaN guards to parseInt across API routes
- Fix DB connection pool config for serverless (max: 1 on Vercel)

## [1.9.0] - 2026-02-27

### Added

- **SDK 1.9.0** — `evalai ci` one-command CI loop, durable run history & diff system, centralized architecture, CI friendliness improvements. See [SDK CHANGELOG](src/packages/sdk/CHANGELOG.md) for details.

## [1.8.0] - 2026-02-26

### Added

- **SDK 1.8.0** — `evalai doctor` rewrite (9-check checklist), `evalai explain` (offline report explainer), `evalai print-config`, guided failure flow, minimal green example. See [SDK CHANGELOG](src/packages/sdk/CHANGELOG.md) for details.

## [1.7.0] - 2026-02-26

### Added

- **`evalai upgrade --full`** — One command to upgrade from Tier 1 (built-in gate) to Tier 2 (full metric gate with golden eval, confidence tests, latency, cost).
- **`detectRunner()`** — Auto-detect CI environment (GitHub Actions, GitLab CI, CircleCI, etc.) for smarter gate defaults.
- **Machine-readable gate output** — `--format json|github|human` for all gate commands.
- **Init test matrix** — Scaffolder now validates across npm/yarn/pnpm before generating workflows.
- **SDK dist files** updated for full CJS/ESM dual-package compatibility.

### Fixed

- **DB test failures** — Fixed 3 test failures: `provider-keys` Date vs String assertion (timestamp migration), `evaluation-service` beforeAll timeout (missing eval-executor mock), `redis-cache` not-configured test (unmocked @upstash/redis).
- **E2E smoke tests** — Switched `toBeVisible()` → `toBeAttached()` for headless Chromium CI compatibility.
- **Rollup CVE** — Added `>=4.59.0` override to fix GHSA-mw96-cpmx-2vgc (path traversal).

### Changed

- **Timestamp migration complete** — All 24 tables now use integer timestamps (`integer({ mode: "timestamp" })`). Batch 1 (5 hot-path tables) and Batch 2 (19 remaining tables) fully migrated.
- **Lint baseline** — Reduced from 302 → 215 warnings (88 `noExplicitAny` fixes).
- **Website docs updated** — Changelog, quick-start, SDK page, CI/CD guide, and documentation hub all reflect v1.7.0 CLI features.
- **llms.txt / llms-full.txt** — Fixed stale version (1.3→1.7), added CLI commands section, corrected wording.

## [1.6.0] - 2026-02-19

### Security

- **Cookie-first authentication** — Removed all `localStorage` bearer token usage across 15+ pages/components. Browser-authenticated requests now use `credentials: "include"` with HttpOnly session cookies exclusively.
- **Webhook secret encryption** — Webhook secrets are now encrypted at rest using AES-256-GCM with per-organization key derivation. Plaintext is returned only once at creation. Migration `0033` adds encrypted columns with backward-compatible lazy encryption.
- **CSP tightened** — Removed `unsafe-eval` in production; kept dev-only for HMR. Added Supabase to script-src allowlist.
- **postMessage origin restricted** — `data-target-origin="*"` replaced with config-driven `NEXT_PUBLIC_SITE_URL`.

### Fixed

- **useSession infinite loop** — Wrapped `fetchSession` in `useCallback` to prevent re-render loop affecting all 28+ authenticated pages.
- **Rate-limit tier mapping** — Added `deriveRateLimitTier()` based on auth type and role. Removed dead `getUserPlanFromRequest` function.
- **Evaluation schema dedup** — Removed duplicate `createEvaluationSchema` from service layer; canonical types now imported from `@/lib/validation`.
- **getStats O(n) query** — Replaced full-table fetch with `COUNT(*)` + `ORDER BY LIMIT 1`.
- **Rate-limit test timeouts** — Fixed 4 test failures caused by unmocked `@sentry/nextjs` initialization in happy-dom.

### Changed

- **Coverage thresholds** — Raised from 5% to 20% (lines, functions, branches, statements).
- **Linting** — Enabled `useExhaustiveDependencies` and `a11y` rules as warnings in Biome.
- **SDK** — Added CJS `require` entries for all subpath exports; bumped to 1.5.6.

### Added

- Cookie-first auth regression test (static analysis — fails CI if `localStorage` bearer tokens reappear).
- Webhook encryption migration safety invariant documented in `docs/migration-safety.md`.
- `NEXT_PUBLIC_SITE_URL` and `PROVIDER_KEY_ENCRYPTION_KEY` added to `.env.example`.

### Removed

- Committed `.tgz` build artifacts from git tracking.

## [1.5.0] - 2026-02-18

- SDK 1.5.0: `--format github`, `--onFail import`, `evalai doctor`, pinned CLI invocation
