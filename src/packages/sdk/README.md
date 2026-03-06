# @evalgate/sdk

[![npm version](https://img.shields.io/npm/v/@evalgate/sdk.svg)](https://www.npmjs.com/package/@evalgate/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@evalgate/sdk.svg)](https://www.npmjs.com/package/@evalgate/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![SDK Tests](https://img.shields.io/badge/tests-1727%2B%20passed-brightgreen.svg)](#)
[![Contract Version](https://img.shields.io/badge/report%20schema-v1-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**AI quality infrastructure. Production failures automatically become regression tests.**

Complete pipeline: discover → manifest → impact → run → diff → PR summary. Plus: production trace collection, failure detection, auto-generated test cases, and golden regression datasets.

Zero to production CI in 60 seconds. No infra. No lock-in. Remove anytime.

---

## Quick Start (60 seconds)

Add this to your `.github/workflows/evalgate.yml`:

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
      - run: npx @evalgate/sdk ci --format github --write-results --base main
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: evalgate-results
          path: .evalgate/
```

Create `eval/your-spec.spec.ts`:

```typescript
import { defineEval } from "@evalgate/sdk";

defineEval("Basic Math Operations", async () => {
  const result = 1 + 1;
  return { pass: result === 2, score: result === 2 ? 100 : 0 };
});

// Object form (with metadata):
defineEval({
  name: "String concatenation",
  description: "Test string operations",
  tags: ["basic", "math"],
  executor: async () => {
    const result = "hello" + " world";
    return { pass: result === "hello world", score: 100 };
  },
});
```

```bash
git add .github/workflows/evalgate.yml eval/
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

## 🚀 New in v3.0.1: Production-Ready AI Quality Infrastructure

### `evalgate ci` - Complete CI Pipeline

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
   Download base artifact and run: evalgate diff --base .evalgate/base-run.json --head .evalgate/last-run.json
   Artifacts: .evalgate/runs/
```

---

## CLI Commands

### 🚀 One-Command CI (v3.0.0)

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

### Compare — Side-by-Side Result Diff

**Important:** `evalgate compare` compares **result files**, not models.
You run each model/config separately (via `evalgate run --write-results`),
then compare the saved JSON artifacts. Nothing is re-executed.

```bash
# The primary interface — two result files:
evalgate compare --base .evalgate/runs/gpt4o-run.json --head .evalgate/runs/claude-run.json

# Optional labels for the output table (cosmetic, not identifiers):
evalgate compare --base gpt4o.json --head claude.json --labels "GPT-4o" "Claude 3.5"

# N-way compare (3+ files):
evalgate compare --runs run-a.json run-b.json run-c.json

# Machine-readable:
evalgate compare --base a.json --head b.json --format json
```

| Command | Description |
|---------|-------------|
| `evalgate compare --base <file> --head <file>` | Compare two run result JSON files |
| `evalgate compare --runs <f1> <f2> [f3...]` | N-way comparison across multiple runs |
| `--labels <l1> <l2>` | Optional human-readable labels for output |
| `--sort-by <key>` | Sort specs by: `name` (default), `score`, `duration` |
| `--format json` | Machine-readable JSON output |

**Workflow:**
```
evalgate run --write-results   # saves .evalgate/runs/run-<id>.json
# change model/config/prompt
evalgate run --write-results   # saves another run file
evalgate compare --base <first>.json --head <second>.json
```

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
| `npx evalgate migrate config --in evalgate.config.json --out eval/migrated.spec.ts` | Convert legacy config to DSL |

**Guided failure flow:**

```
evalgate ci  →  fails  →  "Next: evalgate explain --report .evalgate/last-run.json"
                              ↓
                   evalgate explain  →  root causes + fixes
```

**GitHub Actions step summary** — CI result at a glance with regressions and artifacts:

![GitHub Actions step summary showing CI pass/fail with delta table](../../docs/images/evalgate-gate-step-summary.svg)

**`evalgate explain` terminal output** — root causes + fix commands:

![Terminal output of evalgate explain showing top failures and suggested fixes](../../docs/images/evalgate-explain-terminal.svg)

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

Create `eval/your-spec.spec.ts`:

```typescript
import { defineEval } from "@evalgate/sdk";

defineEval("Basic Math Operations", async () => {
  const result = 1 + 1;
  return { pass: result === 2, score: result === 2 ? 100 : 0 };
});

// Object form (with metadata):
defineEval({
  name: "String concatenation",
  description: "Test string operations",
  tags: ["basic", "math"],
  executor: async () => {
    const result = "hello" + " world";
    return { pass: result === "hello world", score: 100 };
  },
});

// Suite form — group related specs:
defineSuite("Math suite", [
  () => defineEval("addition", async () => ({ pass: 1 + 1 === 2, score: 100 })),
  () => defineEval("subtraction", async () => ({ pass: 5 - 3 === 2, score: 100 })),
]);
```

```bash
# Discover specs and generate manifest
npx @evalgate/sdk discover
npx @evalgate/sdk discover --manifest

# Run evaluations
npx @evalgate/sdk run --write-results

# Run local regression gate
npx @evalgate/sdk gate
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

### Assertions — Sync (fast, heuristic) and Async (slow, LLM-backed)

```typescript
import {
  // Sync — fast and approximate (no API key needed)
  hasSentiment, hasNoToxicity, hasValidCodeSyntax,
  containsLanguage, hasFactualAccuracy, hasNoHallucinations,
  matchesSchema,
  // Async — slow and accurate (requires API key)
  configureAssertions, hasSentimentAsync, hasNoToxicityAsync,
  hasValidCodeSyntaxAsync, containsLanguageAsync,
  hasFactualAccuracyAsync, hasNoHallucinationsAsync,
} from "@evalgate/sdk";

// Configure once (or pass per-call)
configureAssertions({ provider: "openai", apiKey: process.env.OPENAI_API_KEY });

// Sync — fast, no network
console.log(hasSentiment("I love this!", "positive"));   // true
console.log(hasNoToxicity("Have a great day!"));          // true
console.log(hasValidCodeSyntax("function f() {}", "js")); // true

// Async — LLM-backed, context-aware
const { matches, confidence } = await hasSentimentAsync("subtle irony...", "negative");
console.log(matches, confidence);                                     // true, 0.85
console.log(await hasNoToxicityAsync("sarcastic attack text"));       // false
```

### Platform Client

```typescript
import { AIEvalClient } from "@evalgate/sdk";

const client = AIEvalClient.init(); // from EVALGATE_API_KEY env
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
rm evalgate.config.json
```

Your local `openAIChatEval` runs continue to work. No account cancellation. No data export required.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

**v3.0.0** — Major release: Production-ready AI quality infrastructure. Complete repository migration to evalgate organization, Python SDK v3.0.0 with full CI compatibility, enhanced error handling, and comprehensive test coverage (1077 tests passing). All SDKs now at v3.0.0 with unified API surface.

**v2.2.3** — Bug-fix release. `RequestCache` default TTL, `EvalGateError` subclass prototype chain and `retryAfter` direct property, `autoPaginate` now returns `Promise<T[]>` (new `autoPaginateGenerator` for streaming), `createEvalRuntime` config-object overload, `defaultLocalExecutor` callable factory, `SnapshotManager.save` null/undefined safety, `compareSnapshots` loads both sides from disk, `AIEvalClient` default baseUrl → `https://api.evalgate.com`, `importData` optional-chaining guards, `toContainCode` raw-code detection, `hasReadabilityScore` `{min,max}` object form. 141 new regression tests.

**v2.2.2** — 8 stub assertions replaced with real implementations (`hasSentiment` expanded lexicon, `hasNoToxicity` ~80-term blocklist, `hasValidCodeSyntax` real bracket balance, `containsLanguage` 12 languages + BCP-47, `hasFactualAccuracy`/`hasNoHallucinations` case-insensitive, `hasReadabilityScore` per-word syllable fix, `matchesSchema` JSON Schema support). Added LLM-backed `*Async` variants + `configureAssertions`. Fixed `importData` crash, `compareWithSnapshot` object coercion, `WorkflowTracer` defensive guard. 115 new tests.

**v2.2.1** — `snapshot(name, output)` accepts objects; auto-serialized via `JSON.stringify`

**v2.2.0** — `expect().not` modifier, `hasPII()`, `defineSuite` object form, `snapshot` parameter order fix, `specId` collision fix

**v1.8.0** — `evalgate doctor` rewrite (9-check checklist), `evalgate explain` command, guided failure flow, CI template with doctor preflight

**v1.7.0** — `evalgate init` scaffolder, `evalgate upgrade --full`, `detectRunner()`, machine-readable gate output, init test matrix

**v1.6.0** — `evalgate gate`, `evalgate baseline`, regression gate constants & types

## License

MIT

## Support

- **Docs:** https://evalgate.com/documentation
- **Issues:** https://github.com/evalgate/ai-evaluation-platform/issues
