# @pauly4010/evalai-sdk

[![npm version](https://img.shields.io/npm/v/@pauly4010/evalai-sdk.svg)](https://www.npmjs.com/package/@pauly4010/evalai-sdk)
[![npm downloads](https://img.shields.io/npm/dm/@pauly4010/evalai-sdk.svg)](https://www.npmjs.com/package/@pauly4010/evalai-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![SDK Tests](https://img.shields.io/badge/tests-172%20passed-brightgreen.svg)](#)
[![Contract Version](https://img.shields.io/badge/report%20schema-v1-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Stop LLM regressions in CI in minutes.**

Zero to gate in under 5 minutes. No infra. No lock-in. Remove anytime.

---

## Quick Start (2 minutes)

```bash
npx @pauly4010/evalai-sdk init
git add evals/ .github/workflows/evalai-gate.yml evalai.config.json
git commit -m "chore: add EvalAI regression gate"
git push
```

That's it. Open a PR and CI blocks regressions automatically.

`evalai init` detects your project, creates a baseline from your current tests, and installs a GitHub Actions workflow. No manual config needed.

---

## What `evalai init` does

1. **Detects** your Node repo and package manager (npm/yarn/pnpm)
2. **Runs your tests** to capture a real baseline (pass/fail + test count)
3. **Creates `evals/baseline.json`** with provenance metadata
4. **Installs `.github/workflows/evalai-gate.yml`** (package-manager aware)
5. **Creates `evalai.config.json`**
6. **Prints next steps** — just commit and push

---

## CLI Commands

### Regression Gate (local, no account needed)

| Command | Description |
|---------|-------------|
| `npx evalai init` | Full project scaffolder — creates everything you need |
| `npx evalai gate` | Run regression gate locally |
| `npx evalai gate --format json` | Machine-readable JSON output |
| `npx evalai gate --format github` | GitHub Step Summary with delta table |
| `npx evalai baseline init` | Create starter `evals/baseline.json` |
| `npx evalai baseline update` | Re-run tests and update baseline with real scores |
| `npx evalai upgrade --full` | Upgrade from Tier 1 (built-in) to Tier 2 (full gate) |

### API Gate (requires account)

| Command | Description |
|---------|-------------|
| `npx evalai check` | Gate on quality score from dashboard |
| `npx evalai share` | Create share link for a run |

### Debugging & Diagnostics

| Command | Description |
|---------|-------------|
| `npx evalai doctor` | Comprehensive preflight checklist — verifies config, baseline, auth, API, CI wiring |
| `npx evalai explain` | Offline report explainer — top failures, root cause classification, suggested fixes |
| `npx evalai print-config` | Show resolved config with source-of-truth annotations (file/env/default/arg) |

**Guided failure flow:**

```
evalai check  →  fails  →  "Next: evalai explain"
                              ↓
                   evalai explain  →  root causes + fixes
```

<!-- TODO: Add screenshots once recorded
![GitHub Actions step summary showing gate pass/fail](docs/images/evalai-gate-step-summary.png)
![Terminal output of evalai explain](docs/images/evalai-explain-terminal.png)
-->

`check` automatically writes `.evalai/last-report.json` so `explain` works with zero flags.

`doctor` uses exit codes: **0** = ready, **2** = not ready, **3** = infra error. Use `--report` for a JSON diagnostic bundle.

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
npm install @pauly4010/evalai-sdk openai
```

```typescript
import { openAIChatEval } from "@pauly4010/evalai-sdk";

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
import { openAIChatEval, extendExpectWithToPassGate } from "@pauly4010/evalai-sdk";
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
} from "@pauly4010/evalai-sdk";

// Or tree-shakeable:
import { GATE_EXIT } from "@pauly4010/evalai-sdk/regression";
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
} from "@pauly4010/evalai-sdk/regression";
```

### Platform Client

```typescript
import { AIEvalClient } from "@pauly4010/evalai-sdk";

const client = AIEvalClient.init(); // from EVALAI_API_KEY env
// or
const client = new AIEvalClient({ apiKey: "...", organizationId: 123 });
```

### Framework Integrations

```typescript
import { traceOpenAI } from "@pauly4010/evalai-sdk/integrations/openai";
import { traceAnthropic } from "@pauly4010/evalai-sdk/integrations/anthropic";
```

---

## Installation

```bash
npm install @pauly4010/evalai-sdk
# or
yarn add @pauly4010/evalai-sdk
# or
pnpm add @pauly4010/evalai-sdk
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

- **Docs:** https://v0-ai-evaluation-platform-nu.vercel.app/documentation
- **Issues:** https://github.com/pauly7610/ai-evaluation-platform/issues
