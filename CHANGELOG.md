# Changelog

Platform and SDK releases. For detailed SDK changes, see [src/packages/sdk/CHANGELOG.md](src/packages/sdk/CHANGELOG.md).

## [2.1.0] - 2026-03-02

### Added — EvalGate Intelligence Layer

**Backend modules** (505 unit tests, 32 new source files):
- **Phase 0 — Foundation:** `reliability-object`, `lineage`, `version-resolver`, `compat`; `redaction`, `secret-scanner`
- **Phase 1.1 — Trace Intelligence:** `trace-schema` (Zod v1 + version compatibility), `trace-validator`, `trace-freezer` (structural immutability)
- **Phase 1.2 — Failure Detection:** `taxonomy` (8 failure categories), `confidence` (weighted multi-detector aggregation), `detectors/rule-based`
- **Phase 1.3 — Test Generation:** `trace-minimizer`, `generator` (EvalCase generation from traces), `deduplicator` (Jaccard similarity clustering), `test-quality-evaluator`; `testcases/spec` (EvalCase v1 canonical format)
- **Phase 2A — Dataset Coverage:** `coverage-model` with configurable `seedPhrases`, gap detection, cluster coverage ratio
- **Phase 3 — Three-Layer Scoring:** `trace-feature-extractor`, `reasoning-layer`, `action-layer`, `outcome-layer`
- **Phase 4 — Multi-Judge:** `aggregation` (median/mean/weighted/majority/min/max strategies), `transparency` (per-judge audit trail)
- **Phase 5B — Metric DAG Safety:** `dag-safety` (cycle detection, missing finalScore, max depth, reachability)
- **Phase 7 — Drift Intelligence:** `behavioral-drift` (6 signal types), `drift-explainer`
- **Phase 8B/8C — Replay + Attribution:** `replay/determinism`, `regression/attribution`

**UX components** (40 DOM tests, 5 new React components):
- `score-layer-breakdown` — reasoning/action/outcome score bars with evidence flags
- `judge-vote-panel` — per-judge votes, agreement %, strategy label, confidence badge
- `drift-severity-badge` — color-coded severity (none → critical) with signal list
- `coverage-gap-list` — gap list with importance progress bars and coverage ratio
- `failure-confidence-badge` — failure category + confidence % + detector agreement

### Changed

- **EvalCase ID** upgraded from 32-bit FNV-1a (8 hex chars) to 64-bit FNV-1a (16 hex chars) — format: `ec_<16 hex>`. Negligible collision probability at any realistic test registry size.
- **`sdk/package.json`**: `test` script changed from `vitest` (watch) to `vitest run` (CI-safe); `test:watch` added for developer use.
- **`run-platform-ci.ts`**: Added `--skip-db` flag for local runs without PostgreSQL; coverage audit now skipped automatically when `--skip-db` is active.

### Fixed

- Refusal constraint regex: replaced PCRE-only `(?i)` inline flag with `[Ii]`/`[Aa]` character classes — was throwing `SyntaxError` in any JS runtime calling `new RegExp(value)`
- `majority_vote` aggregation tie: pass == fail now returns `finalScore: 0.5` instead of silently returning 1.0
- `secret-scanner.ts`: extracted assignment from `while` condition to satisfy `noAssignInExpressions` (was valid JS but lint error)
- `drift-severity-badge.tsx`: replaced array index key with `${type}-${description}` composite key
- Biome `organizeImports`: auto-fixed 61 test files with unsorted import blocks

## [2.0.0] - 2026-03-01

### Breaking — EvalGate Rebrand

- **Package names:** `@pauly4010/evalai-sdk` → `@evalgate/sdk`, `pauly4010-evalai-sdk` → `pauly4010-evalgate-sdk`
- **CLI:** `evalai` → `evalgate`
- **Config dir:** `.evalai/` → `.evalgate/` (legacy still read with deprecation warning)
- **Env vars:** `EVALAI_*` → `EVALGATE_*` (legacy still work with deprecation warning)
- **Error class:** `EvalAIError` → `EvalGateError`

### Added

- Deprecation warnings when using legacy env vars, config paths, or `.evalai/`

### Deprecated

- `@pauly4010/evalai-sdk` and `pauly4010-evalai-sdk` — use `@evalgate/sdk` and `pauly4010-evalgate-sdk` instead

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
