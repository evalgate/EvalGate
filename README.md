# EvalGate

[![Platform CI](https://github.com/pauly7610/ai-evaluation-platform/actions/workflows/platform-ci.yml/badge.svg)](https://github.com/pauly7610/ai-evaluation-platform/actions/workflows/platform-ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/pauly7610/ai-evaluation-platform?style=flat-square)](https://github.com/pauly7610/ai-evaluation-platform)
[![npm](https://img.shields.io/npm/v/@evalgate/sdk?style=flat-square&logo=npm&color=cb3837)](https://www.npmjs.com/package/@evalgate/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@evalgate/sdk?style=flat-square&logo=npm)](https://www.npmjs.com/package/@evalgate/sdk)
[![PyPI](https://img.shields.io/pypi/v/pauly4010-evalgate-sdk?style=flat-square&logo=python&color=3776ab)](https://pypi.org/project/pauly4010-evalgate-sdk/)
[![PyPI downloads](https://img.shields.io/pypi/dm/pauly4010-evalgate-sdk?style=flat-square&logo=pypi)](https://pypi.org/project/pauly4010-evalgate-sdk/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/pauly7610/ai-evaluation-platform/pulls)

Stop LLM regressions in CI in 2 minutes.

No infra. No lock-in. Remove anytime.

**EvalGate = CI for AI behavior.** Block regressions before they reach production.

## Why EvalGate?

LLMs don't fail like traditional software — they drift silently. A prompt tweak or model swap can degrade quality by 15% and you won't notice until users complain. EvalGate turns evaluations into CI gates so regressions never reach production.

## Quick Start

### Node.js

```bash
npx @evalgate/sdk init
git push
```

That's it. `evalgate init` detects your Node project, runs your tests to create a baseline, installs a GitHub Actions workflow, and prints what to commit. Open a PR and CI blocks regressions automatically.

### Python

```bash
pip install pauly4010-evalgate-sdk
```

```python
from evalgate_sdk import AIEvalClient, expect
from evalgate_sdk.types import CreateTraceParams

# Local assertions — no API key needed
result = expect("The capital of France is Paris.").to_contain("Paris")
print(result.passed)  # True

# Platform: trace and evaluate with API key
client = AIEvalClient(api_key="sk-...")
trace = await client.traces.create(CreateTraceParams(name="chat-quality"))
```

Same CI gate, same quality checks. Python SDK has full parity with TypeScript: assertions, test suites, OpenAI/Anthropic tracing, LangChain/CrewAI/AutoGen integrations, and regression gates. **Python CLI:** `pip install "pauly4010-evalgate-sdk[cli]"` → `evalgate init`, `evalgate run`, `evalgate gate`, `evalgate ci` ([docs](docs/python-cli.md)).

## What happens on a PR?

1. CI runs `npx evalgate gate`
2. Gate runs your tests and compares against the baseline
3. If tests regress → CI blocks the merge
4. If tests pass → merge proceeds
5. A regression report is uploaded as a CI artifact

## Two Paths

### Path A: Local gate (no account, no API key)

```bash
npx @evalgate/sdk init    # scaffold everything
npx evalgate gate                    # run gate locally
npx evalgate baseline update         # update baseline after intentional changes
```

Works for any Node.js project with a `test` script.

### Path B: Platform gate (dashboard, history, LLM judge)

```bash
npx evalgate init                    # creates evalgate.config.json
# paste evaluationId from dashboard
npx evalgate check --format github --onFail import
```

Adds quality score tracking, baseline comparisons, trace coverage, and PR annotations.

## Debug in 30 Seconds

When CI fails, don't guess — follow the guided flow:

```bash
npx evalgate doctor              # preflight: is everything wired correctly?
npx evalgate check               # run the gate (writes .evalgate/last-report.json)
npx evalgate explain             # what failed, why, and how to fix it
```

`check` automatically saves a report artifact. `explain` reads it with zero flags and prints:

- **Top failing test cases** with input/expected/actual
- **What changed** from baseline (score, pass rate, safety)
- **Root cause classification** (prompt drift, retrieval drift, safety regression, …)
- **Suggested fixes** with exact commands

Works offline. No API calls needed for `explain`.

<details>
<summary><strong>See it in action</strong> (click to expand)</summary>

**GitHub Actions step summary** — gate result at a glance:

![GitHub Actions step summary](docs/images/evalgate-gate-step-summary.svg)

**`evalgate explain` terminal output** — root causes + fix commands:

![evalgate explain terminal output](docs/images/evalai-explain-terminal.svg)

</details>

## Remove anytime

```bash
rm evalgate.config.json evals/ .github/workflows/evalgate-gate.yml
```

No account cancellation. No data export. Your tests keep working.

**Live demo:** [https://evalgate.com](https://evalgate.com)

Open source. Production-ready. **1.4k+ npm downloads/month** · Used by developers building AI systems that ship to production. [Terms of Service](https://evalgate.com/terms) · [Privacy Policy](https://evalgate.com/privacy)

## Platform Readiness

| Capability                                                                                      | Status              |
| ----------------------------------------------------------------------------------------------- | ------------------- |
| CI regression gate (`evalgate ci`, `evalgate gate`)                                                 | Production          |
| TypeScript SDK ([`@evalgate/sdk`](https://www.npmjs.com/package/@evalgate/sdk)) | Production (v2.0.0) |
| Python SDK ([`pauly4010-evalgate-sdk`](https://pypi.org/project/pauly4010-evalgate-sdk/))           | Production          |
| Multi-tenant auth & RBAC                                                                        | Production          |
| Evaluation engine (50+ templates, 4 types)                                                      | Production          |
| Audit logging & governance presets                                                              | Production          |
| Observability (traces, spans, cost tracking)                                                    | Production          |
| Self-hosted Docker                                                                              | Beta                |
| Advanced product analytics                                                                      | Planned             |
| Additional SDKs (Go, Rust)                                                                      | Roadmap             |

## CI in One Command

Add to your `.github/workflows/evalgate.yml`:

```yaml
name: EvalGate CI
on: [push, pull_request]
jobs:
  evalgate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx evalgate ci --format github --write-results --base main
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: evalgate-results
          path: .evalgate/
```

**That's it!** Your CI now:

- ✅ Discovers evaluation specs automatically
- ✅ Runs only impacted specs (smart caching)
- ✅ Compares results against base branch
- ✅ Posts rich summary in PR with regressions
- ✅ Exits with proper codes (0=clean, 1=regressions, 2=config)

**Docs:** [Features](FEATURES.md) · [CI Quickstart](docs/CI_QUICKSTART.md) · [Quickstart](docs/quickstart.md) · [Architecture](docs/ARCHITECTURE.md) · [Regression Gate](docs/REGRESSION_GATE.md) · [CI Artifacts](docs/CI_ARTIFACTS.md) · [AI Assistant Integration](docs/AI_ASSISTANT_INTEGRATION.md) · [Contributor Map](docs/CONTRIBUTOR_MAP.md) · [Releasing](docs/RELEASING.md) · [All Docs](docs/INDEX.md)

---

## Key Features

> **EvalGate is CI for AI behavior.** Same gates, same quality checks — whether you use Node, Python, or the REST API.

### Regression Gate

- **Zero-config scaffolder** — `npx evalgate init` detects repo, creates baseline, installs CI workflow
- **Built-in gate** — works with any `npm test` / `pnpm test` / `yarn test`
- **Advanced gate** — golden eval scores, confidence tests, p95 latency, cost tracking
- **GitHub Step Summary** — delta tables, pass/fail icons, artifact upload
- **Baseline governance** — CODEOWNERS, label gates, anti-cheat guards

### Evaluation

- **Four evaluation types:** Unit Tests, Human Evaluation, LLM Judge, A/B Testing
- **50+ evaluation templates** across chatbots, RAG, code-gen, adversarial, multimodal, and industry domains
- **Visual evaluation builder** — compose evals with drag-and-drop, no code required
- **Quality score dashboard** — pass rates, trends, and drill-down into failures

### Developer Experience

- **Full TypeScript SDK** — [`@evalgate/sdk`](https://www.npmjs.com/package/@evalgate/sdk) with CLI, regression gate, traces, evaluations, LLM judge
- **Python SDK** — [`pauly4010-evalgate-sdk`](https://pypi.org/project/pauly4010-evalgate-sdk/) with assertions, test workflows, OpenAI/Anthropic/LangChain/CrewAI/AutoGen integrations, and CLI (`evalgate run`, `evalgate gate`, `evalgate ci`)
- **CLI commands** — `evalgate init`, `evalgate gate`, `evalgate baseline`, `evalgate upgrade`, `evalgate check`, `evalgate doctor`, `evalgate explain`, `evalgate print-config`, `evalgate share`
- **Programmatic exports** — gate exit codes, categories, report types via `@evalgate/sdk/regression`
- **API keys** — scoped keys for CI/CD and production

## Local Development

### Prerequisites

- Node.js >= 20
- pnpm >= 10 (`npm install -g pnpm`)

### Setup

```bash
git clone https://github.com/pauly7610/ai-evaluation-platform.git
cd ai-evaluation-platform

pnpm install
cp .env.example .env.local
# Edit .env.local with your PostgreSQL, OAuth, and auth secrets

pnpm db:migrate
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

> **Note:** The TypeScript SDK (`@evalgate/sdk`) is published to npm separately. For SDK consumers, `npm install @evalgate/sdk` is the correct install command. The Python SDK is available via `pip install pauly4010-evalgate-sdk`.

## Architecture

```
ai-evaluation-platform/
├── src/app/              # Next.js App Router pages
│   ├── api/              # REST API routes (55+ endpoints)
│   │   ├── evaluations/  # Eval CRUD, runs, test-cases, publish
│   │   ├── llm-judge/    # LLM Judge evaluate, configs, alignment
│   │   ├── traces/       # Distributed tracing + spans
│   │   └── ...
├── src/packages/sdk/     # TypeScript SDK (@evalgate/sdk)
├── src/packages/sdk-python/  # Python SDK (evalgate-sdk on PyPI)
├── src/lib/              # Core services, utilities, templates
├── src/db/               # Database layer (Drizzle ORM schema)
└── drizzle/              # Database migrations
```

## Contributing

Contributions are welcome! Please use `pnpm` for all local development. Run tests with `pnpm test` before submitting.

```bash
pnpm install        # Install dependencies
pnpm dev            # Start dev server
pnpm test           # Run tests (temp DB per worker, migrations in setup)
pnpm build          # Production build
```

Open an issue or submit a pull request at [https://github.com/pauly7610/ai-evaluation-platform](https://github.com/pauly7610/ai-evaluation-platform).

## License

MIT
