# @evalgate/sdk

[![npm version](https://img.shields.io/npm/v/@evalgate/sdk.svg)](https://www.npmjs.com/package/@evalgate/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@evalgate/sdk.svg)](https://www.npmjs.com/package/@evalgate/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![SDK Tests](https://img.shields.io/badge/tests-172%20passed-brightgreen.svg)](#)
[![Contract Version](https://img.shields.io/badge/report%20schema-v1-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**One-command CI for AI evaluation. Complete pipeline: discover → manifest → impact → run → diff → PR summary.**

Zero to production CI in 60 seconds. No infra. No lock-in. Remove anytime.

---

## Quick Start (60 seconds)

Add this to your `.github/workflows/evalai.yml`:

```yaml
name: EvalGate CI
on: [push, pull_request]
jobs:
  evalai:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx @evalgate/sdk ci --format github --write-results --base main
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: evalai-results
          path: .evalai/
```

Create `eval/your-spec.spec.ts`:

```typescript
import { defineEval } from "@evalgate/sdk";

defineEval({
  name: "Basic Math Operations",
  description: "Test fundamental arithmetic",
  prompt: "Test: 1+1=2, string concatenation, array includes",
  expected: "All tests should pass",
  tags: ["basic", "math"],
  category: "unit-test"
});
```

```bash
git add .github/workflows/evalai.yml eval/
git commit -m "feat: add EvalGate CI pipeline"
git push
```

That's it! Your CI now:
- ✅ Discovers evaluation specs automatically
- ✅ Runs only impacted specs (smart caching)
- ✅ Compares results against base branch
- ✅ Posts rich summary in PR with regressions
- ✅ Exits with proper codes (0=clean, 1=regressions, 2=config)

---

## 🚀 New in v2.0.0: One-Command CI

### `evalai ci` - Complete CI Pipeline

```bash
npx @evalgate/sdk ci --format github --write-results --base main
```

**What it does:**
1. **Discover** - Finds all evaluation specs automatically
2. **Manifest** - Builds stable manifest if missing
3. **Impact Analysis** - Runs only specs impacted by changes (optional)
4. **Run** - Executes evaluations with artifact retention
5. **Diff** - Compares results against base branch
6. **PR Summary** - Posts rich markdown summary to GitHub
7. **Debug Flow** - Prints copy/paste next step on failure

**Advanced Options:**
```bash
npx @evalgate/sdk ci --base main --impacted-only    # Run only impacted specs
npx @evalgate/sdk ci --format json --write-results   # JSON output for automation
npx @evalgate/sdk ci --base develop                  # Custom base branch
```

### Smart Diffing & GitHub Integration

```bash
npx @evalgate/sdk diff --base main --head last --format github
```

**Features:**
- 📊 Pass rate delta and score changes
- 🚨 Regression detection with classifications
- 📈 Improvements and new specs
- 📁 Artifact links and technical details
- 🎯 Exit codes: 0=clean, 1=regressions, 2=config

### Self-Documenting Failures

Every failure prints a clear next step:

```
🔧 Next step for debugging:
   Download base artifact and run: evalai diff --base .evalai/base-run.json --head .evalai/last-run.json
   Artifacts: .evalai/runs/
```

---

## CLI Commands

### 🚀 One-Command CI (v2.0.0)

| Command | Description |
|---------|-------------|
| `npx evalgate ci` | Complete CI pipeline: discover → manifest → impact → run → diff → PR summary |
| `npx evalgate ci --base main` | Run CI with diff against main branch |
| `npx evalgate ci --impacted-only` | Run only specs impacted by changes |
| `npx evalgate ci --format github` | GitHub Step Summary with rich markdown |
| `npx evalgate ci --format json` | JSON output for automation |

### Discovery & Manifest

| Command | Description |
|---------|-------------|
| `npx evalgate discover` | Find and analyze evaluation specs |
| `npx evalgate discover --manifest` | Generate stable manifest for incremental analysis |

### Impact Analysis

| Command | Description |
|---------|-------------|
| `npx evalgate impact-analysis --base main` | Analyze impact of changes |
| `npx evalgate impact-analysis --changed-files file1.ts,file2.ts` | Analyze specific changed files |

### Run & Diff

| Command | Description |
|---------|-------------|
| `npx evalgate run` | Run evaluation specifications |
| `npx evalgate run --write-results` | Run with artifact retention |
| `npx evalgate diff --base main` | Compare results against base branch |
| `npx evalgate diff --base last --head last` | Compare last two runs |
| `npx evalgate diff --format github` | GitHub Step Summary with regressions |

### Legacy Regression Gate (local, no account needed)

| Command | Description |
|---------|-------------|
| `npx evalgate init` | Full project scaffolder — creates everything you need |
| `npx evalgate gate` | Run regression gate locally |
| `npx evalgate gate --format json` | Machine-readable JSON output |
| `npx evalgate gate --format github` | GitHub Step Summary with delta table |
| `npx evalgate baseline init` | Create starter `evals/baseline.json` |
| `npx evalgate baseline update` | Re-run tests and update baseline with real scores |
| `npx evalgate upgrade --full` | Upgrade from Tier 1 (built-in) to Tier 2 (full gate) |

### API Gate (requires account)

| Command | Description |
|---------|-------------|
| `npx evalgate check` | Gate on quality score from dashboard |
| `npx evalgate share` | Create share link for a run |

### Debugging & Diagnostics

| Command | Description |
|---------|-------------|
| `npx evalgate doctor` | Comprehensive preflight checklist — verifies config, baseline, auth, API, CI wiring |
| `npx evalgate explain` | Offline report explainer — top failures, root cause classification, suggested fixes |
| `npx evalgate print-config` | Show resolved config with source-of-truth annotations (file/env/default/arg) |

### Migration Tools

| Command | Description |
|---------|-------------|
| `npx evalgate migrate config --in evalai.config.json --out eval/migrated.spec.ts` | Convert legacy config to DSL |

**Guided failure flow:**

```
evalai ci  →  fails  →  "Next: evalai explain --report .evalai/last-run.json"
                              ↓
                   evalai explain  →  root causes + fixes
```

**GitHub Actions step summary** — CI result at a glance with regressions and artifacts:

![GitHub Actions step summary showing CI pass/fail with delta table](../../docs/images/evalai-gate-step-summary.svg)

**`evalai explain` terminal output** — root causes + fix commands:

![Terminal output of evalai explain showing top failures and suggested fixes](../../docs/images/evalai-explain-terminal.svg)

All commands automatically write artifacts so `explain` works with zero flags.

### Gate Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Pass — no regression |
| 1 | Regression detected |
| 2 | Infra error (baseline missing, tests crashed) |

### Check Exit Codes (API mode)

| Code | Meaning |
|------|---------|
| 0 | Pass |
| 1 | Score below threshold |
| 2 | Regression failure |
| 3 | Policy violation |
| 4 | API error |
| 5 | Bad arguments |
| 6 | Low test count |
| 7 | Weak evidence |
| 8 | Warn (soft regression) |

### Doctor Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Ready — all checks passed |
| 2 | Not ready — one or more checks failed |
| 3 | Infrastructure error |

---

## How the Gate Works

**Built-in mode** (any Node project, no config needed):
- Runs `<pm> test`, captures exit code + test count
- Compares against `evals/baseline.json`
- Writes `evals/regression-report.json`
- Fails CI if tests regress

**Project mode** (advanced, for full regression gate):
- If `eval:regression-gate` script exists in `package.json`, delegates to it
- Supports golden eval scores, confidence tests, p95 latency, cost tracking
- Full delta table with tolerances

---

## Run a Regression Test Locally (no account)

```bash
npm install @evalgate/sdk openai
```

```typescript
import { openAIChatEval } from "@evalgate/sdk";

await openAIChatEval({
  name: "chat-regression",
  cases: [
    { input: "Hello", expectedOutput: "greeting" },
    { input: "2 + 2 = ?", expectedOutput: "4" },
  ],
});
```

Output: `PASS 2/2 (score: 100)`. No account needed. Just a score.

### Vitest Integration

```typescript
import { openAIChatEval, extendExpectWithToPassGate } from "@evalgate/sdk";
import { expect } from "vitest";

extendExpectWithToPassGate(expect);

it("passes gate", async () => {
  const result = await openAIChatEval({
    name: "chat-regression",
    cases: [
      { input: "Hello", expectedOutput: "greeting" },
      { input: "2 + 2 = ?", expectedOutput: "4" },
    ],
  });
  expect(result).toPassGate();
});
```

---

## SDK Exports

### Regression Gate Constants

```typescript
import {
  GATE_EXIT,           // { PASS: 0, REGRESSION: 1, INFRA_ERROR: 2, ... }
  GATE_CATEGORY,       // { PASS: "pass", REGRESSION: "regression", INFRA_ERROR: "infra_error" }
  REPORT_SCHEMA_VERSION,
  ARTIFACTS,           // { BASELINE, REGRESSION_REPORT, CONFIDENCE_SUMMARY, LATENCY_BENCHMARK }
} from "@evalgate/sdk";

// Or tree-shakeable:
import { GATE_EXIT } from "@evalgate/sdk/regression";
```

### Types

```typescript
import type {
  RegressionReport,
  RegressionDelta,
  Baseline,
  BaselineTolerance,
  GateExitCode,
  GateCategory,
} from "@evalgate/sdk/regression";
```

### Platform Client

```typescript
import { AIEvalClient } from "@evalgate/sdk";

const client = AIEvalClient.init(); // from EVALAI_API_KEY env
// or
const client = new AIEvalClient({ apiKey: "...", organizationId: 123 });
```

### Framework Integrations

```typescript
import { traceOpenAI } from "@evalgate/sdk/integrations/openai";
import { traceAnthropic } from "@evalgate/sdk/integrations/anthropic";
```

---

## Installation

```bash
npm install @evalgate/sdk
# or
yarn add @evalgate/sdk
# or
pnpm add @evalgate/sdk
```

Add `openai` as a peer dependency if using `openAIChatEval`:

```bash
npm install openai
```

## Environment Support

| Feature | Node.js | Browser |
|---------|---------|---------|
| Platform APIs (Traces, Evaluations, LLM Judge) | ✅ | ✅ |
| Assertions, Test Suites, Error Handling | ✅ | ✅ |
| CJS/ESM | ✅ | ✅ |
| CLI, Snapshots, File Export | ✅ | — |
| Context Propagation | ✅ Full | ⚠️ Basic |

## No Lock-in

```bash
rm evalai.config.json
```

Your local `openAIChatEval` runs continue to work. No account cancellation. No data export required.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

**v1.8.0** — `evalai doctor` rewrite (9-check checklist), `evalai explain` command, guided failure flow, CI template with doctor preflight

**v1.7.0** — `evalai init` scaffolder, `evalai upgrade --full`, `detectRunner()`, machine-readable gate output, init test matrix

**v1.6.0** — `evalai gate`, `evalai baseline`, regression gate constants & types

**v1.5.8** — secureRoute fix, test infra fixes, 304 handling fix

**v1.5.5** — PASS/WARN/FAIL semantics, flake intelligence, golden regression suite

**v1.5.0** — GitHub annotations, `--onFail import`, `evalai doctor`

## License

MIT

## Support

- **Docs:** https://evalgate.com/documentation
- **Issues:** https://github.com/pauly7610/ai-evaluation-platform/issues
