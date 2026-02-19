# EvalAI

[![npm](https://img.shields.io/npm/v/@pauly4010/evalai-sdk?style=flat-square&logo=npm&color=cb3837)](https://www.npmjs.com/package/@pauly4010/evalai-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/pauly7610/ai-evaluation-platform/pulls)

Stop LLM regressions in CI in 5 minutes.

No infra. No lock-in. Remove it anytime.

## 1) Run a regression test locally (60 seconds)

```bash
npm install @pauly4010/evalai-sdk openai
```

```typescript
import { openAIChatEval } from '@pauly4010/evalai-sdk';

await openAIChatEval({
  name: 'chat-regression',
  cases: [
    { input: 'Hello', expectedOutput: 'greeting' },
    { input: '2 + 2 = ?', expectedOutput: '4' }
  ]
});
```

That's it.

You'll see: `PASS 2/2 (score: 100)`

No account required. No dashboard required. Just a score.

## 2) Gate regressions in CI (2 more minutes)

```bash
npx -y @pauly4010/evalai-sdk@^1 init
```

Then paste your evaluation ID into `evalai.config.json`:

```json
{ "evaluationId": "42" }
```

Now add to CI:

```bash
npx -y @pauly4010/evalai-sdk@^1 check --format github --onFail import
```

If your score drops below the baseline, CI fails. That's your regression gate.

## What happens when it fails?

- Score drops
- Baseline comparison detects regression
- `evalai check` exits non-zero
- CI blocks the merge

Simple.

## Remove anytime

Delete `evalai.config.json`. That's it.

## What You Get (Optional)

If you connect to the hosted platform: quality score history, baseline comparisons, trace coverage, signed reports, human eval, MCP tools. But none of that is required to start.

EvalAI is just a regression gate.

**Live demo:** [https://v0-ai-evaluation-platform-nu.vercel.app](https://v0-ai-evaluation-platform-nu.vercel.app)

---

## Key Features

### Evaluation
- **Four evaluation types:** Unit Tests, Human Evaluation, LLM Judge, A/B Testing
- **50+ evaluation templates** across chatbots, RAG, code-gen, adversarial, multimodal, and industry domains
- **Visual evaluation builder** — compose evals with drag-and-drop, no code required
- **Quality score dashboard** — pass rates, trends, and drill-down into failures

### Developer Experience
- **Full TypeScript SDK** — `@pauly4010/evalai-sdk` with `openAIChatEval`, traces, evaluations, LLM judge, webhooks
- **CLI** — `evalai init` and `evalai check` for CI gates (use `npx -y @pauly4010/evalai-sdk@^1` for pinned CI)
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
pnpm test           # Run tests (runs test:db-setup first to migrate test.db)
pnpm build          # Production build
```

Open an issue or submit a pull request at [https://github.com/pauly7610/ai-evaluation-platform](https://github.com/pauly7610/ai-evaluation-platform).

## License

MIT
