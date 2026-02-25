# Contributor Map

One-page guide: what lives where, how to test it, where to add new code.

## Project Layout

```
ai-evaluation-platform/
├── src/
│   ├── app/                   # Next.js App Router (pages + API routes)
│   │   ├── api/               # REST API — 55+ endpoints
│   │   ├── (authenticated)/   # Dashboard pages (require session)
│   │   └── actions/           # Server actions
│   ├── components/            # React components (UI layer)
│   ├── db/                    # Drizzle ORM schema + seeds
│   ├── hooks/                 # React hooks
│   ├── lib/                   # Core business logic ← most new code goes here
│   │   ├── arena/             # A/B comparison engine
│   │   ├── jobs/              # Background job runner
│   │   ├── scoring/           # Quality score algorithms
│   │   ├── sdk/               # SDK mapper + transformer
│   │   └── services/          # Domain services (workflow, LLM judge, etc.)
│   └── packages/
│       └── sdk/               # @pauly4010/evalai-sdk (published to npm)
├── tests/                     # All test files (mirrors src/ structure)
├── scripts/                   # Build/CI/audit scripts
├── docs/                      # Documentation
├── examples/                  # Real-world usage examples
├── drizzle/                   # Database migrations
└── evals/                     # Regression gate baseline + schemas
```

## Test Lanes

Three isolated test environments. **Never mix them.**

| Lane | Config | Environment | Runs | Add tests for… |
|------|--------|-------------|------|----------------|
| **Unit** | `vitest.unit.config.ts` | Node (no DB) | `pnpm test:unit` | Pure logic, services, utilities, SDK |
| **DB** | `vitest.db.config.ts` | Node + SQLite | `pnpm test:db` | API routes, DB queries, integration |
| **DOM** | `vitest.dom.config.ts` | JSDOM | `pnpm test:dom` | React components |

### Where to put new tests

| You're changing… | Test lane | Test location |
|------------------|-----------|---------------|
| `src/lib/scoring/*` | Unit | `tests/unit/scoring/` |
| `src/lib/services/*` | Unit | `tests/unit/services/` |
| `src/lib/jobs/*` | Unit | `src/lib/jobs/__tests__/` |
| `src/app/api/*` | DB | `tests/api/` |
| `src/components/*` | DOM | `tests/components/` |
| `src/packages/sdk/*` | SDK | `src/packages/sdk/src/__tests__/` |
| `src/db/schema.ts` | DB | `tests/api/` (via integration) |

### Running tests

```bash
# Focused (preferred — always do this first)
pnpm vitest run tests/unit/scoring/your-test.test.ts

# Full lane
pnpm test:unit
pnpm test:db
pnpm test:dom

# SDK tests (separate vitest config)
pnpm sdk:test

# Coverage for a lane
pnpm test:unit:coverage
pnpm test:db:coverage
pnpm test:dom:coverage

# Never run the full suite unless explicitly needed
# pnpm test  ← avoid this
```

### Key rule: Unit tests must not import `@/db`

If your test touches the database (directly or transitively), it belongs in the **DB lane**. The unit lane must stay fast and DB-free.

## Code Style

- **Biome** — linting + formatting (no ESLint/Prettier)
- Run `pnpm lint` to check, `pnpm format` to auto-fix
- Pre-commit hooks (Husky) run Biome on staged files

## SDK Development

The SDK lives at `src/packages/sdk/` and is published as `@pauly4010/evalai-sdk`.

```bash
# Build
pnpm sdk:build

# Test
pnpm sdk:test

# Test specific file
pnpm vitest run src/packages/sdk/src/__tests__/cli/init-scaffolder.test.ts
```

### SDK exports map

| Import path | What it provides |
|-------------|-----------------|
| `@pauly4010/evalai-sdk` | `AIEvalClient`, gate constants, core types |
| `@pauly4010/evalai-sdk/regression` | `GATE_EXIT`, `GATE_CATEGORY`, report types |
| `@pauly4010/evalai-sdk/assertions` | Test assertions |
| `@pauly4010/evalai-sdk/testing` | Test suite builder |
| `@pauly4010/evalai-sdk/matchers` | Custom matchers |
| `@pauly4010/evalai-sdk/integrations/openai` | `traceOpenAI` |
| `@pauly4010/evalai-sdk/integrations/anthropic` | `traceAnthropic` |

### CLI commands (source in `src/packages/sdk/src/cli/`)

| File | Command |
|------|---------|
| `index.ts` | Router — dispatches to subcommands |
| `init.ts` | `evalai init` |
| `regression-gate.ts` | `evalai gate` |
| `baseline.ts` | `evalai baseline init/update` |
| `upgrade.ts` | `evalai upgrade --full` |
| `check.ts` | `evalai check` |
| `doctor.ts` | `evalai doctor` |
| `share.ts` | `evalai share` |

## CI Pipeline

```
platform-ci.yml
  ├── quality        (lint + typecheck)
  ├── unit-confidence (unit tests)
  ├── db-confidence   (DB tests)
  ├── regression-gate (baseline comparison)
  ├── sdk             (SDK build + test + contract)
  └── build           (Next.js production build)
```

All jobs must pass before merge. The regression gate compares against `evals/baseline.json`.

## Commit Conventions

```
feat: add drift detection z-score threshold
fix: correct rate-limit error message typo
docs: update API contract for run imports
test: add unit tests for scoring algorithms
ci: add SDK build+test job to platform CI
chore: bump SDK to v1.7.0
```

## Quick Checklist Before PR

1. `pnpm lint` — clean (≤303 warnings)
2. `pnpm typecheck` — clean
3. Focused tests pass on changed files
4. Docs updated if public API changed
5. No `@/db` imports in unit-lane tests
