# API Versioning Strategy

## Current State

| Path | Audience | Stability |
|------|----------|-----------|
| `/api/*` | Internal (dashboard, SDK, MCP) | Can change without notice |
| `/api/v1/*` | Public (rewrites to `/api/*`) | Same handlers; version prefix for future stability |

## Request Headers (SDK / CLI)

All SDK and CLI requests send version headers so the platform can identify client versions:

| Header | Source | Purpose |
|--------|--------|---------|
| `X-EvalGate-SDK-Version` | `@evalgate/sdk` package version | Identify SDK release |
| `X-EvalGate-Spec-Version` | `docs/openapi.json` `info.version` | Identify API spec version |

These headers are sent on every request. The platform can use them for compatibility checks, deprecation warnings, and support debugging.

## Policy

- **`/api`** — Internal API. Used by the hosted dashboard, SDK, MCP tools, and CI. We may add, change, or remove endpoints. Breaking changes are acceptable for internal consumers; we coordinate via SDK releases and changelogs.
- **`/api/v1`** — Public API. A Next.js rewrite maps `/api/v1/*` → `/api/*` so the same handlers serve both. When we document the public API for third-party integrations, we will:
  - Commit to stability guarantees (see `docs/api-contract.md`)
  - Version the OpenAPI spec (e.g. `openapi: 3.1.0`, `info.version: "1.0.0"`)

## Breaking Changes and CI

When the OpenAPI spec changes:

1. Add an entry to `docs/OPENAPI_CHANGELOG.md` for the new version
2. Run `pnpm version:spec X.Y.Z` (updates `docs/openapi.json` and `src/packages/sdk/src/version.ts`)
3. Run `pnpm openapi:snapshot` to update the stored spec hash
4. Commit all changes

CI runs `audit:openapi` which fails unless: snapshot is updated, changelog has the version entry, and `info.version` matches `SPEC_VERSION`.

## Migration Path

Implementation (done):

1. Next.js rewrite in `next.config.ts`: `{ source: '/api/v1/:path*', destination: '/api/:path*' }`
2. `/api/*` remains for internal use; SDK/dashboard consumers unchanged.
3. Document versioning and deprecation policy in `docs/api-contract.md` when ready.

## References

- OpenAPI spec: `src/lib/api-docs.ts` (served at `/api/docs`)
- Spec changelog: `docs/OPENAPI_CHANGELOG.md` (required for hash changes)
- Contract/stability: `docs/api-contract.md`
- Integration reference: `docs/INTEGRATION_REFERENCE.md`
