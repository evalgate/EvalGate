# Changelog

Platform and SDK releases. For detailed SDK changes, see [src/packages/sdk/CHANGELOG.md](src/packages/sdk/CHANGELOG.md).

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
