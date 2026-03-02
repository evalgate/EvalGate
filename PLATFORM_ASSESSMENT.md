# AI Evaluation Platform — Cross-Dimensional Assessment

*Last updated: March 2025*

This document grades the platform across nine dimensions. All assumptions have been verified against the codebase (see Verification Summary below).

---

## Summary Table

| Dimension | Grade | Priority |
|-----------|-------|----------|
| 1. Architecture & Structure | **B+** | Medium |
| 2. Code Quality | **B** | Medium |
| 3. Testing | **B** | Medium |
| 4. Security & Auth | **A-** | Low |
| 5. Documentation | **A** | Low |
| 6. CI/CD & DevOps | **A-** | Low |
| 7. SDK & Integrations | **A** | Low |
| 8. Production Readiness | **B+** | Medium |
| 9. Feature Completeness | **B+** | Medium |

---

## Verification Summary

All claims below were verified before grading:

| Claim | Verified |
|-------|----------|
| 44 tables in schema | `grep -c pgTable` in schema.ts |
| 21 services | 21 `*.service.ts` files in `src/lib/services/` |
| No services index.ts | `Glob` returned 0 files |
| arena-matches uses secureRoute | [`arena-matches/route.ts`](src/app/api/arena-matches/route.ts) |
| 3 legacy routes | billing-portal, costs/pricing (POST only), onboarding/setup |
| costs/pricing GET is public | No auth on GET; POST uses `requireAdmin` |
| exports/r use secureRoute | Both use `secureRoute({ allowAnonymous: true })` |
| pnpm test passes | 37 unit files, 604 tests; db + dom pass |
| pnpm typecheck passes | Exit 0 |
| pnpm lint | Passes on CI (evals/*.json gitignored). Fails locally if evals artifacts exist. |
| docs/INDEX.md links | ~49 markdown links |
| 6 ADRs | 000-template through 005 |
| 46 templates | 39 catalog + 7 featured |
| No ONBOARDING.md, SDK_VERSIONING.md | 0 files found |
| Health check public | [`health/route.ts`](src/app/api/health/route.ts) has no auth |
| test:coverage:gate not in CI | 0 matches in .github workflows |

---

## 1. Architecture & Structure — B+

### Current State

| Aspect | Reference |
|--------|-----------|
| App Router | Next.js App Router; pages under [`src/app/`](src/app/) |
| DB Schema | 44 tables in [`src/db/schema.ts`](src/db/schema.ts) (Drizzle ORM, PostgreSQL) |
| Service Layer | 21 services in [`src/lib/services/`](src/lib/services/) |
| Migrations | Single consolidated migration in [`drizzle/0000_opposite_fenris.sql`](drizzle/0000_opposite_fenris.sql) |

### Strengths

- Clear separation: routes → services → DB
- ADRs document key decisions ([`docs/adr/`](docs/adr/))
- Consistent `@/` import alias
- Server Components by default

### Weaknesses & What to Do Differently

| Weakness | Location | Recommendation |
|----------|----------|----------------|
| No service barrel export | `src/lib/services/` has no `index.ts` | Add `src/lib/services/index.ts` that re-exports all services. |
| Single large migration | [`drizzle/0000_opposite_fenris.sql`](drizzle/0000_opposite_fenris.sql) | For future schema changes, generate incremental migrations (`pnpm db:migrate:new`). |
| Some route logic in handlers | Various `src/app/api/**/route.ts` | Move business logic into services; keep routes thin. |

---

## 2. Code Quality — B

### Current State

| Aspect | Reference |
|--------|-----------|
| Linting | Biome in [`biome.json`](biome.json); `pnpm lint` |
| Types | TypeScript strict; `pnpm typecheck` passes |
| Warning budget | 215 warnings enforced in [`.github/workflows/platform-ci.yml`](.github/workflows/platform-ci.yml) (lines 54–73) |

### Strengths

- Single toolchain (Biome for lint + format)
- lint-staged + husky for pre-commit
- Consistent import paths

### Weaknesses & What to Do Differently

| Weakness | Location | Recommendation |
|----------|----------|----------------|
| `noExplicitAny` disabled in 8+ override groups | [`biome.json`](biome.json) | Fix `any` usages; use `unknown` + type guards or explicit types. |
| `secureRoute` handler uses `ctx: any` | [`src/lib/api/secure-route.ts`](src/lib/api/secure-route.ts) lines 132, 177 | Replace with `ctx: AuthContext` in first overload. |
| Lint fails on evals artifacts locally | `evals/confidence-summary.json`, etc. | These files are gitignored; CI passes on fresh clone. Run `pnpm biome format evals/` after generating locally, or add evals to Biome exclude. |

---

## 3. Testing — B

### Current State

| Aspect | Reference |
|--------|-----------|
| Unit | Vitest; 37 files, 604 tests; [`vitest.unit.config.ts`](vitest.unit.config.ts) |
| DB/Integration | PGlite in-memory; [`vitest.db.config.ts`](vitest.db.config.ts) |
| DOM | Vitest + JSDOM; [`vitest.dom.config.ts`](vitest.dom.config.ts) |
| E2E | Playwright; [`e2e/smoke.test.ts`](e2e/smoke.test.ts), [`e2e/golden-flows.test.ts`](e2e/golden-flows.test.ts) |
| Confidence | [`scripts/run-confidence.ts`](scripts/run-confidence.ts); [`tests/unit/confidence/`](tests/unit/confidence/) |
| Regression gate | [`scripts/regression-gate.ts`](scripts/regression-gate.ts) |

### Strengths

- Three test lanes (unit, db, dom); all pass
- PGlite for DB tests (no Postgres in CI)
- Confidence tests and regression gate
- Audit scripts (route-auth, OpenAPI, etc.)

### Weaknesses & What to Do Differently

| Weakness | Location | Recommendation |
|----------|----------|----------------|
| No coverage gate in CI | [`.github/workflows/platform-ci.yml`](.github/workflows/platform-ci.yml) | `test:coverage:gate` exists in package.json but is NOT run in platform-ci. Add step. |
| E2E minimal | Only smoke + golden-flows | Add E2E for critical user flows (login, create evaluation, run eval). |

### Next Step

Add coverage gate to platform-ci (after `test` job):

```yaml
- name: Coverage gate
  run: pnpm test:coverage:gate
```

---

## 4. Security & Auth — A-

### Current State

| Aspect | Reference |
|--------|-----------|
| Auth wrapper | [`src/lib/api/secure-route.ts`](src/lib/api/secure-route.ts) |
| Route audit | [`tests/audits/route-auth-audit.test.ts`](tests/audits/route-auth-audit.test.ts) |
| Rate limiting | [`src/lib/rate-limit.ts`](src/lib/rate-limit.ts), [`src/lib/api-rate-limit.ts`](src/lib/api-rate-limit.ts) |
| Tiers | anonymous 30/min, free 200, pro 1000, enterprise 10000, mcp 100 |

### Strengths

- Centralized `secureRoute()` for auth, org, rate limit, error envelope
- Route-auth-audit enforces `secureRoute` or allowlist
- RBAC, API key scopes
- Sentry without PII

### Weaknesses & What to Do Differently

| Weakness | Location | Recommendation |
|----------|----------|----------------|
| 3 legacy routes not using `secureRoute` | See below | Migrate to `secureRoute()`. |
| Rate limiting falls back when Redis unconfigured | [`src/lib/rate-limit.ts`](src/lib/rate-limit.ts) lines 56–80 | When Redis is down, `routeRisk: "sensitive"` routes are blocked. Document in ops runbook. |
| `arena-matches` in LEGACY_AUTH_ALLOWLIST but already uses secureRoute | [`tests/audits/route-auth-audit.test.ts`](tests/audits/route-auth-audit.test.ts) line 37 | Remove `arena-matches/route.ts` from `LEGACY_AUTH_ALLOWLIST`. |

**Legacy routes to migrate (verified):**

| Route | Current pattern | Migration |
|-------|-----------------|-----------|
| [`src/app/api/billing-portal/route.ts`](src/app/api/billing-portal/route.ts) | `auth.api.getSession` + `withRateLimit` | Use `secureRoute({ requireOrg: false })`. |
| [`src/app/api/costs/pricing/route.ts`](src/app/api/costs/pricing/route.ts) | GET public; POST uses `requireAdmin` + `withRateLimit` | Use `secureRoute({ allowAnonymous: true })` for GET; `secureRoute({ minRole: "admin" })` for POST. |
| [`src/app/api/onboarding/setup/route.ts`](src/app/api/onboarding/setup/route.ts) | `getCurrentUser` + `withRateLimit` | Use `secureRoute({ requireOrg: false })` — user may not have org yet. |

### Next Step

Migrate [`src/app/api/onboarding/setup/route.ts`](src/app/api/onboarding/setup/route.ts) first. Then remove `arena-matches/route.ts` from `LEGACY_AUTH_ALLOWLIST`.

---

## 5. Documentation — A

### Current State

| Aspect | Reference |
|--------|-----------|
| Index | [`docs/INDEX.md`](docs/INDEX.md) — ~49 doc links |
| ADRs | [`docs/adr/`](docs/adr/) — 6 ADRs |
| API | [`docs/openapi.json`](docs/openapi.json), [`docs/API_VERSIONING.md`](docs/API_VERSIONING.md) |
| Contributing | [`CONTRIBUTING.md`](CONTRIBUTING.md), [`SECURITY.md`](SECURITY.md) |

### Strengths

- Central index, ADRs, architecture docs
- OpenAPI spec and changelog
- CONTRIBUTING and SECURITY

### Weaknesses & What to Do Differently

| Weakness | Location | Recommendation |
|----------|----------|----------------|
| No onboarding doc | — | Add `docs/ONBOARDING.md`: clone → install → run dev → first PR in &lt;15 min. |
| Some docs may be stale | Various | Add "Last updated" to key docs; run periodic doc review. |
| No SDK versioning doc | — | Add `docs/SDK_VERSIONING.md` for TS/Python SDK compatibility and release process. |

---

## 6. CI/CD & DevOps — A-

### Current State

| Aspect | Reference |
|--------|-----------|
| Pipeline | [`.github/workflows/platform-ci.yml`](.github/workflows/platform-ci.yml) |
| Stages | quality → unit-confidence, db-confidence → regression-gate → test, build, sdk, audits |
| Audits | OpenAPI, demo-assets, golden eval, performance, migrations, indexes, retention |
| Dependency audit | `pnpm audit --audit-level=high` (line 474) |

### Strengths

- Multi-stage pipeline with confidence tests
- Regression gate
- Audit scripts
- CodeQL, Dependabot
- `pnpm audit` fails job when high/critical vulns exist (verified: 13 low/moderate → exit 0)

### Weaknesses & What to Do Differently

| Weakness | Location | Recommendation |
|----------|----------|----------------|
| No staging deploy | — | For production readiness, add a staging environment. |
| DB tests use PGlite, not real Postgres | CI env | Acceptable for speed; document that integration tests use PGlite. |

---

## 7. SDK & Integrations — A

### Current State

| Aspect | Reference |
|--------|-----------|
| TS SDK | [`src/packages/sdk/`](src/packages/sdk/) — `@evalgate/sdk` v2.0.0 |
| Python SDK | [`src/packages/sdk-python/`](src/packages/sdk-python/) — `pauly4010-evalgate-sdk` v2.0.0 |
| CLI | `evalgate` in SDK package.json bin |
| Integrations | OpenAI, Anthropic, optional LangChain |

### Strengths

- Both SDKs published (npm, PyPI)
- CLI, parity between TS and Python
- Optional integrations

### Weaknesses & What to Do Differently

| Weakness | Location | Recommendation |
|----------|----------|----------------|
| Python package name differs from TS | `pauly4010-evalgate-sdk` vs `@evalgate/sdk` | Document in README; consider `evalgate-sdk` on PyPI if available. |
| No SDK versioning doc | — | Add `docs/SDK_VERSIONING.md`. |

---

## 8. Production Readiness — B+

### Current State

| Aspect | Reference |
|--------|-----------|
| Health check | [`src/app/api/health/route.ts`](src/app/api/health/route.ts) — **public, no auth** |
| Deep health | [`src/app/api/health/deep/route.ts`](src/app/api/health/deep/route.ts) — admin-only |
| Observability | Sentry, [`src/lib/logger.ts`](src/lib/logger.ts), request IDs |
| Error envelope | [`src/lib/api/errors.ts`](src/lib/api/errors.ts) |

### Strengths

- `GET /api/health` returns 200 without auth (suitable for load balancers)
- Request IDs, structured logs
- Sentry without PII

### Weaknesses & What to Do Differently

| Weakness | Location | Recommendation |
|----------|----------|----------------|
| Deep health is admin-only | [`src/app/api/health/deep/route.ts`](src/app/api/health/deep/route.ts) | Acceptable for detailed checks. Ensure basic `/api/health` is used for LB. |
| No scaling doc | — | Add `docs/SCALING.md` or section in ARCHITECTURE. |

---

## 9. Feature Completeness — B+

### Current State

| Aspect | Reference |
|--------|-----------|
| Core | Evaluations, runs, traces, LLM judge |
| Templates | 46 templates (39 catalog + 7 featured) in [`src/lib/evaluation-templates/`](src/lib/evaluation-templates/), [`src/lib/evaluation-templates-library.ts`](src/lib/evaluation-templates-library.ts) |
| Multi-tenant | Orgs, RBAC, API keys |

### Strengths

- Multi-tenant, RBAC
- 46 templates
- Governance presets

### Weaknesses & What to Do Differently

| Weakness | Location | Recommendation |
|----------|----------|----------------|
| Regression gate | [`scripts/regression-gate.ts`](scripts/regression-gate.ts) | Ensure baseline is updated when intentional changes are made; document in CONTRIBUTING. |

### Next Step

Add branch protection requiring `unit-confidence`, `db-confidence`, `regression-gate`, `build`, `sdk` to pass before merge.

---

## Top 5 Priority Actions

1. **Add coverage gate to CI** — `pnpm test:coverage:gate` exists but is not run in platform-ci.
2. **Migrate legacy auth routes** — Move `billing-portal`, `costs/pricing`, `onboarding/setup` to `secureRoute`; remove `arena-matches` from LEGACY_AUTH_ALLOWLIST.
3. **Remove `ctx: any` from secureRoute** — Type the handler context in [`src/lib/api/secure-route.ts`](src/lib/api/secure-route.ts).
4. **Add `docs/ONBOARDING.md`** — Short path for new contributors.
5. **Add `docs/SDK_VERSIONING.md`** — Version compatibility and release process.

---

## References

- [Platform CI workflow](.github/workflows/platform-ci.yml)
- [Route auth audit](tests/audits/route-auth-audit.test.ts)
- [Secure route implementation](src/lib/api/secure-route.ts)
- [Rate limiting](src/lib/rate-limit.ts)
- [Documentation index](docs/INDEX.md)
- [ADR index](docs/adr/)
