# Architecture

## Product Split: Local Gate vs Platform Gate

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Your Repository                              │
│                                                                     │
│  package.json          evals/baseline.json     evalgate.config.json   │
│  (test script)         (committed truth)       (optional)           │
└──────────┬──────────────────────┬───────────────────┬───────────────┘
           │                      │                   │
           ▼                      ▼                   ▼
┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│   Tier 1: Local Gate │  │  Tier 2: Full    │  │  Platform Gate       │
│   (no account)       │  │  Gate (no acct)  │  │  (API key required)  │
├──────────────────────┤  ├──────────────────┤  ├──────────────────────┤
│                      │  │                  │  │                      │
│  npx evalgate init     │  │  npx evalgate      │  │  npx evalgate check    │
│  npx evalgate gate     │  │  upgrade --full  │  │  --format github     │
│                      │  │                  │  │  --onFail import     │
│  Runs: <pm> test     │  │  Runs: custom    │  │                      │
│  Compares: exit code │  │  gate script     │  │  Calls: quality API  │
│    + test count      │  │  Compares: golden │  │  Compares: score vs  │
│                      │  │    eval, latency, │  │    baseline, policy  │
│  Output:             │  │    cost, tests   │  │                      │
│  regression-report   │  │                  │  │  Output:             │
│  .json               │  │  Output:         │  │  PR annotations,     │
│                      │  │  regression-     │  │  step summary,       │
│  CI: evalai-gate.yml │  │  report.json +   │  │  dashboard import    │
│                      │  │  governance.yml  │  │                      │
└──────────────────────┘  └──────────────────┘  └──────────────────────┘
         │                        │                       │
         └────────────┬───────────┘                       │
                      │                                   │
              No account needed                   Requires account
              No API key needed                   EVALAI_API_KEY
              Works offline                       Dashboard + history
```

### Decision Matrix

| | Tier 1 (Local) | Tier 2 (Full) | Platform |
|--|-----------------|---------------|----------|
| **Setup** | `npx evalgate init` | `npx evalgate upgrade --full` | Dashboard + config |
| **Account** | No | No | Yes |
| **API key** | No | No | Yes |
| **What it gates** | Test pass/fail + count | Golden eval, latency, cost, tests | Quality score, policy |
| **CI workflow** | Auto-generated | Upgraded auto-generated | Manual or auto |
| **Report format** | JSON + human + GitHub | JSON + human + GitHub | JSON + human + GitHub |
| **Dashboard** | No | No | Yes |
| **History** | Git only | Git only | Platform DB |
| **LLM judge** | No | No | Yes |
| **Baseline governance** | No | Yes (CODEOWNERS + labels) | N/A (server-side) |
| **Remove** | Delete 3 files | Delete 3 files + scripts | Delete config |

### Upgrade Path

```
npx evalgate init          →  npx evalgate upgrade --full  →  Add evaluationId +
(Tier 1 in 2 min)            (Tier 2 in 1 min)            EVALAI_API_KEY
                                                           (Platform in 5 min)
```

Each tier is additive. You can use Tier 1 + Platform simultaneously.

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Next.js App Router                 │
│                                                     │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Dashboard  │  │ API      │  │ Server Actions   │ │
│  │ Pages      │  │ Routes   │  │                  │ │
│  │ (React)    │  │ (REST)   │  │                  │ │
│  └─────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
│        │              │                  │           │
│        └──────────────┼──────────────────┘           │
│                       ▼                              │
│  ┌─────────────────────────────────────────────────┐ │
│  │                 src/lib/                         │ │
│  │                                                 │ │
│  │  services/      scoring/      jobs/     arena/  │ │
│  │  (workflow,     (quality      (runner,  (A/B    │ │
│  │   LLM judge,    score,        enqueue)  compare)│ │
│  │   evaluations)  algorithms)                     │ │
│  └────────────────────┬────────────────────────────┘ │
│                       ▼                              │
│  ┌─────────────────────────────────────────────────┐ │
│  │              src/db/ (Drizzle ORM)              │ │
│  │              PostgreSQL (via postgres driver)     │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              src/packages/sdk/                       │
│              @evalgate/sdk                   │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ CLI      │  │ Client   │  │ Integrations      │ │
│  │ (init,   │  │ (API     │  │ (OpenAI,          │ │
│  │  gate,   │  │  client,  │  │  Anthropic,       │ │
│  │  check,  │  │  traces,  │  │  tracing)         │ │
│  │  doctor) │  │  evals)   │  │                   │ │
│  └──────────┘  └──────────┘  └───────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Data Flow: Regression Gate

```
Developer pushes PR
        │
        ▼
CI triggers evalai-gate.yml
        │
        ▼
npx evalgate gate
        │
        ├── Has eval:regression-gate script?
        │       │
        │   Yes ▼                    No ▼
        │   Run project script       Run <pm> test
        │   (Tier 2 full gate)       (Tier 1 built-in)
        │       │                        │
        │       ▼                        ▼
        │   Compare golden eval,     Compare exit code
        │   confidence, latency,     + test count vs
        │   cost vs baseline         baseline
        │       │                        │
        └───────┴────────────────────────┘
                │
                ▼
        Write evals/regression-report.json
                │
                ▼
        Exit 0 (pass) or 1 (regression) or 2 (infra_error)
                │
                ▼
        CI blocks or allows merge
```
