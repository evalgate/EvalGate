# API Versioning Strategy

## Current State

| Path | Audience | Stability |
|------|----------|-----------|
| `/api/*` | Internal (dashboard, SDK, MCP) | Can change without notice |
| `/api/v1/*` | Public (rewrites to `/api/*`) | Same handlers; version prefix for future stability |

## Policy

- **`/api`** — Internal API. Used by the hosted dashboard, SDK, MCP tools, and CI. We may add, change, or remove endpoints. Breaking changes are acceptable for internal consumers; we coordinate via SDK releases and changelogs.
- **`/api/v1`** — Public API. A Next.js rewrite maps `/api/v1/*` → `/api/*` so the same handlers serve both. When we document the public API for third-party integrations, we will:
  - Commit to stability guarantees (see `docs/api-contract.md`)
  - Version the OpenAPI spec (e.g. `openapi: 3.1.0`, `info.version: "1.0.0"`)

## Migration Path

Implementation (done):

1. Next.js rewrite in `next.config.ts`: `{ source: '/api/v1/:path*', destination: '/api/:path*' }`
2. `/api/*` remains for internal use; SDK/dashboard consumers unchanged.
3. Document versioning and deprecation policy in `docs/api-contract.md` when ready.

## References

- OpenAPI spec: `src/lib/api-docs.ts` (served at `/api/docs`)
- Contract/stability: `docs/api-contract.md`
- Integration reference: `docs/INTEGRATION_REFERENCE.md`
