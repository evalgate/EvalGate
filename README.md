# EvalAI

[![Platform CI](https://github.com/pauly7610/ai-evaluation-platform/actions/workflows/platform-ci.yml/badge.svg)](https://github.com/pauly7610/ai-evaluation-platform/actions/workflows/platform-ci.yml)
[![npm](https://img.shields.io/npm/v/@pauly4010/evalai-sdk?style=flat-square&logo=npm&color=cb3837)](https://www.npmjs.com/package/@pauly4010/evalai-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/pauly7610/ai-evaluation-platform/pulls)

Stop LLM regressions in CI in 2 minutes.

No infra. No lock-in. Remove anytime.

## Quick Start

```bash
npx @pauly4010/evalai-sdk init
git push
```

That's it. `evalai init` detects your Node project, runs your tests to create a baseline, installs a GitHub Actions workflow, and prints what to commit. Open a PR and CI blocks regressions automatically.

## What happens on a PR?

1. CI runs `npx evalai gate`
2. Gate runs your tests and compares against the baseline
3. If tests regress → CI blocks the merge
4. If tests pass → merge proceeds
5. A regression report is uploaded as a CI artifact

## Two Paths

### Path A: Local gate (no account, no API key)

```bash
npx @pauly4010/evalai-sdk init    # scaffold everything
npx evalai gate                    # run gate locally
npx evalai baseline update         # update baseline after intentional changes
```

Works for any Node.js project with a `test` script.

### Path B: Platform gate (dashboard, history, LLM judge)

```bash
npx evalai init                    # creates evalai.config.json
# paste evaluationId from dashboard
npx evalai check --format github --onFail import
```

Adds quality score tracking, baseline comparisons, trace coverage, and PR annotations.

## Remove anytime

```bash
rm evalai.config.json evals/ .github/workflows/evalai-gate.yml
```

No account cancellation. No data export. Your tests keep working.

**Live demo:** [https://v0-ai-evaluation-platform-nu.vercel.app](https://v0-ai-evaluation-platform-nu.vercel.app)

**Docs:** [Quickstart](docs/quickstart.md) · [Architecture](docs/ARCHITECTURE.md) · [Regression Gate](docs/REGRESSION_GATE.md) · [Contributor Map](docs/CONTRIBUTOR_MAP.md) · [Releasing](docs/RELEASING.md) · [Share Security](docs/SHARE_SECURITY.md) · [All Docs](docs/INDEX.md)

---

## Key Features

### Regression Gate
- **Zero-config scaffolder** — `npx evalai init` detects repo, creates baseline, installs CI workflow
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
- **Full TypeScript SDK** — [`@pauly4010/evalai-sdk`](https://www.npmjs.com/package/@pauly4010/evalai-sdk) with CLI, regression gate, traces, evaluations, LLM judge
- **CLI commands** — `evalai init`, `evalai gate`, `evalai baseline`, `evalai upgrade`, `evalai check`, `evalai doctor`, `evalai share`
- **Programmatic exports** — gate exit codes, categories, report types via `@pauly4010/evalai-sdk/regression`
- **API keys** — scoped keys for CI/CD and production

## Local Development

### Prerequisites

- Node.js >= 18
- pnpm >= 10 (`npm install -g pnpm`)

### Setup

```bash
git clone https://github.com/pauly7610/ai-evaluation-platform.git
cd ai-evaluation-platform

pnpm install
cp .env.example .env.local
# Edit .env.local with your Turso, OAuth, and auth secrets

pnpm drizzle-kit push
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

> **Note:** The SDK package (`@pauly4010/evalai-sdk`) is published to npm separately. For SDK consumers, `npm install @pauly4010/evalai-sdk` is the correct install command.

## Architecture

```
ai-evaluation-platform/
├── src/app/              # Next.js App Router pages
│   ├── api/              # REST API routes (55+ endpoints)
│   │   ├── evaluations/  # Eval CRUD, runs, test-cases, publish
│   │   ├── llm-judge/    # LLM Judge evaluate, configs, alignment
│   │   ├── traces/       # Distributed tracing + spans
│   │   └── ...
├── src/packages/sdk/     # TypeScript SDK (@pauly4010/evalai-sdk)
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
