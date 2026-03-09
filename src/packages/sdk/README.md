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

## How EvalGate Works

EvalGate is a **closed-loop AI quality system**. It connects production traffic to your eval suite so failures discovered in production become regression tests automatically.

```
Production Traffic
       │
       ▼  reportTrace()          ← asymmetric sampling: 10% success, 100% errors
       │
       ▼  Failure Detection      ← candidates auto-quarantined for review
       │
       ▼  evalgate label         ← you assign: pass/fail + failure mode (interactive)
       │
       ▼  evalgate analyze       ← frequency × impact: which modes hurt most?
       │
       ▼  evalgate ci            ← regression gate with validated judge credibility
       │
       ▼  PR blocked or merged   ← loop restarts with new production data
```

**The core insight:** your eval suite is not a one-time setup. It is a living document driven by production evidence. Every label you apply becomes a regression test that prevents the same failure from shipping again.

---

## 🚀 New: Zero to Golden Dataset in 30 Minutes

Transform your AI application from basic testing to data-driven quality assurance with labeled golden datasets.

**📖 [Complete Guide →](../../docs/ZERO_TO_GOLDEN_DATASET.md)**

What you'll build:
- ✅ Automated evaluation pipeline (2 minutes)
- ✅ Production trace collection (5 minutes) 
- ✅ Failure detection and auto-labeling (10 minutes)
- ✅ Golden dataset with failure modes (15 minutes)
- ✅ CI/CD integration with regression protection (5 minutes)
- ✅ Budget-aware evaluation loop (3 minutes)

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

## Two Quickstart Paths

### Path A: Local Gate (no account, no API key)

```bash
npx @evalgate/sdk init
npx evalgate gate
npx evalgate baseline update
```

Use this path when you want CI regression blocking from your existing test suite only.

### Path B: Platform Gate (dashboard, history, PR annotations)

```bash
npx evalgate init
npx evalgate check --format github --onFail import
```

Use this path when you want quality score trends, trace-linked failures, and PR annotation workflows.

### Which path is right for you?

| I want to… | Use |
|------------|-----|
| Block test regressions in CI — no account needed | Path A: Local Gate |
| Track quality scores, history, and PR annotations | Path B: Platform Gate |
| Turn production failures into regression tests | [`reportTrace()`](#production-trace-collection) + `evalgate label` |
| Understand *why* my eval is failing right now | [`evalgate explain`](#debugging--diagnostics) |
| Measure how reliable my LLM judge is | [Judge Credibility config](#-v302--judge-credibility--analyze-phase) |
| Define and track application-specific failure modes | [`evalgate failure-modes`](#analyze-pipeline-302) |
| Go from zero to labeled golden dataset | [30-minute guide →](../../docs/ZERO_TO_GOLDEN_DATASET.md) |

---

## 🚀 v3.x highlights: Production-Ready AI Quality Infrastructure

### 🆕 v3.0.2 — Judge Credibility + Analyze Phase

Build a labeled golden dataset, measure failure-mode frequency, and trust your judge score.

```bash
# Step 1 — Define your app's specific failure modes (run once)
npx evalgate failure-modes

# Step 2 — Label production traces interactively
npx evalgate label
# Arrow keys to navigate, u to undo, Ctrl-C saves progress

# Step 3 — Frequency report across all labeled traces
npx evalgate analyze

# Step 4 — Compare two runs and decide keep/discard
npx evalgate replay-decision --previous .evalgate/runs/run-prev.json --current .evalgate/runs/run-latest.json
```

**Judge Credibility config** (`evalgate.config.json`):

```json
{
  "judge": {
    "bootstrapSeed": 42,
    "tprMin": 0.70,
    "tnrMin": 0.70,
    "minLabeledSamples": 30
  },
  "failureModeAlerts": {
    "modes": {
      "hallucination":  { "weight": 1.5, "maxPercent": 10 },
      "off_topic":      { "weight": 1.0, "maxPercent": 20, "maxCount": 5 },
      "wrong_format":   { "weight": 0.8, "maxPercent": 15 }
    }
  }
}
```

When `discriminative power (TPR+TNR−1) ≤ 0.05`, correction is skipped and gate exits 8 (WARN) instead of silently using a biased score. Bootstrap CI is skipped when `n < 30` — both emit reason codes into the `judgeCredibility` block of the JSON report.

**Example `judgeCredibility` output** (from `.evalgate/runs/run-*.json`):

```json
// Nominal case — correction applied, CI computed
{
  "judgeCredibility": {
    "tpr": 0.85,
    "tnr": 0.78,
    "discriminativePower": 0.63,
    "rawPassRate": 0.72,
    "correctedPassRate": 0.74,
    "correctionSkippedReason": null,
    "bootstrapCI": { "lower": 0.68, "upper": 0.80 },
    "ciSkippedReason": null
  }
}

// Degraded case 1 — near-random judge (TPR+TNR-1 ≤ 0.05)
{
  "judgeCredibility": {
    "tpr": 0.52,
    "tnr": 0.51,
    "discriminativePower": 0.03,
    "rawPassRate": 0.68,
    "correctedPassRate": 0.68,  // ← same as raw
    "correctionSkippedReason": "NEAR_RANDOM",
    "bootstrapCI": { "lower": 0.62, "upper": 0.74 },
    "ciSkippedReason": null
  }
}

// Degraded case 2 — insufficient labeled samples (n < 30)
{
  "judgeCredibility": {
    "tpr": 0.88,
    "tnr": 0.82,
    "discriminativePower": 0.70,
    "rawPassRate": 0.71,
    "correctedPassRate": 0.73,
    "correctionSkippedReason": null,
    "bootstrapCI": null,
    "ciSkippedReason": "INSUFFICIENT_SAMPLES"
  }
}
```

When `correctionSkippedReason` is non-null and you have `judgeTprMin`/`judgeTnrMin` configured, gate exits 8 (WARN) instead of 0 (PASS) or 1 (FAIL).

---

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

### Analyze Pipeline (3.0.2)

| Command | Description |
|---------|-------------|
| `npx evalgate failure-modes` | Define 5–10 named binary failure modes with pass/fail criteria |
| `npx evalgate label` | Interactive per-trace labeling: numbered menu, resume support, undo (`u`), session summary |
| `npx evalgate label --dataset <path>` | Label a specific JSONL dataset file |
| `npx evalgate analyze` | Read `.evalgate/golden/labeled.jsonl`, output per-mode frequency report |
| `npx evalgate replay-decision --previous <f> --current <f>` | Compare corrected pass rates across two runs; emits `keep`/`discard` with `comparisonBasis` |

**Labeled dataset schema** — `.evalgate/golden/labeled.jsonl`:

```jsonl
{"caseId":"ec_abc123","input":"...","expected":"...","actual":"...","label":"fail","failureMode":"hallucination","labeledAt":"2026-03-09T05:00:00.000Z"}
{"caseId":"ec_def456","input":"...","expected":"...","actual":"...","label":"pass","failureMode":null,"labeledAt":"2026-03-09T05:01:00.000Z"}
```

### Configuration Reference

**Complete `evalgate.config.json` schema** — all fields are optional unless marked required:

```jsonc
{
  // Judge credibility (3.0.2)
  "judge": {
    "bootstrapSeed": 42,           // number — deterministic bootstrap seed for CI reproducibility
    "tprMin": 0.70,                // number (0-1) — gate fails if judge TPR < this
    "tnrMin": 0.70,                // number (0-1) — gate fails if judge TNR < this
    "minLabeledSamples": 30        // number — skip CI when labeled dataset has fewer samples
  },

  // Failure mode alerts (3.0.2)
  "failureModeAlerts": {
    "modes": {
      "hallucination": {
        "weight": 1.5,             // number — impact multiplier (frequency × weight)
        "maxPercent": 10,          // number (0-100) — alert if >10% of failures are this mode
        "maxCount": null           // number | null — alert if absolute count exceeds this
      },
      "off_topic": {
        "weight": 1.0,
        "maxPercent": 20,
        "maxCount": 5
      }
    }
  },

  // Baseline tolerance (local gate)
  "baseline": {
    "path": "evals/baseline.json", // string — path to baseline file
    "tolerance": {
      "score": 5,                  // number — allow ±5 point score drop
      "testCount": 0,              // number — fail if test count drops
      "passRate": 0.05             // number (0-1) — allow 5% pass rate drop
    }
  },

  // Evaluation discovery
  "discovery": {
    "include": ["eval/**/*.spec.ts"],  // string[] — glob patterns to include
    "exclude": ["**/*.test.ts"],       // string[] — glob patterns to exclude
    "manifestPath": ".evalgate/manifest.json"
  },

  // Budget limits (3.0.2)
  "budget": {
    "maxTraces": 100,              // number — stop after N traces evaluated
    "maxCostUsd": null             // number | null — stop when cost exceeds (requires CostProvider)
  },

  // API client (platform mode)
  "apiKey": "eg_...",              // string — or use EVALGATE_API_KEY env var
  "baseUrl": "https://api.evalgate.com",
  "organizationId": 123            // number — or auto-detected from API key
}
```

**Environment variable equivalents:**

- `EVALGATE_API_KEY` → `apiKey`
- `EVALGATE_BASE_URL` → `baseUrl`
- `EVALGATE_ORG_ID` → `organizationId`

Config file takes precedence over env vars. CLI flags take precedence over config file.

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

**Example annotated output:**

```
$ npx evalgate explain

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 📊 Evaluation Report Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run ID: run-abc123
Overall: 68/100 (12 passed, 6 failed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 🔴 Top 3 Failures
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. refund-policy-adherence (score: 45/100)
   Classification: SPECIFICATION GAP
   ↳ Your evalgate.md says "Must not promise refunds beyond 30 days"
     but your prompt doesn't mention the 30-day window.
   
   Fix: Add to system prompt:
     "Our refund policy is 30 days from purchase. Do not promise refunds
      outside this window."

2. hallucination-check (score: 50/100)
   Classification: GENERALIZATION FAILURE
   ↳ Your prompt clearly states "Only use facts from the knowledge base"
     but the model invented a shipping time (2-3 days) not in the KB.
   
   Fix: This is a model capability issue. Consider:
     - Switching to a more capable model (gpt-4 → gpt-4-turbo)
     - Adding few-shot examples of correct KB usage
     - Lowering temperature to reduce hallucination

3. tone-professional (score: 60/100)
   Classification: SPECIFICATION GAP
   ↳ evalgate.md says "empathetic, professional" but your prompt says
     "be helpful" — not specific enough.
   
   Fix: Replace "be helpful" with:
     "Use an empathetic, professional tone. Acknowledge the customer's
      frustration before offering solutions."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 💡 Suggested Actions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Priority 1 (SPEC GAPS — fix your prompt):
  • refund-policy-adherence
  • tone-professional

Priority 2 (GEN FAILURES — model limitations):
  • hallucination-check

Next: Fix Priority 1 items, re-run evalgate ci, then address Priority 2.
```

All commands automatically write artifacts so `explain` works with zero flags.

### Gate + Check Exit Codes (complete)

| Code | Meaning | Trigger |
|------|---------|--------|
| 0 | Pass | No regression |
| 1 | Regression | Score drop beyond threshold |
| 2 | Infra error | Baseline missing, tests crashed |
| 8 | **WARN** | Soft regression, or judge correction skipped while thresholds configured |

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

### Assertions: From Scaffolding to Application-Specific

**Generic assertions are scaffolding. The goal is application-specific binary checks tied to your failure modes.**

#### Cost Tier Labeling (3.0.2)

Tag each assertion with its execution cost tier so budget tracking is accurate:

```typescript
import { defineEval, expect } from "@evalgate/sdk";

defineEval("SQL safety check", async () => {
  const response = await yourApp.generate("Generate a report query");

  // "code" = fast local check (no API call)
  const structureOk = expect(response).withCostTier("code").toContain("SELECT");

  // "llm" = slow LLM-backed check (consumes tokens)
  const safetyOk = await expect(response).withCostTier("llm").toNotHallucinateAsync(facts);

  return { pass: structureOk.passed && safetyOk.passed, score: ... };
});
```

Cost tiers flow into the normalized eval budget and `evalgate analyze` frequency reports.

#### Application-Specific Binary Checks (Primary Pattern)

Build checks that map directly to your application's failure modes:

```typescript
import { defineEval, expect } from "@evalgate/sdk";

defineEval("Contains Required Constraints", async () => {
  const response = await yourApp.generate("Generate a SQL query for user reports");
  
  return expect(response)
    .withCostTier("high")
    .containsRequiredConstraints({
      mustInclude: ["SELECT", "FROM", "WHERE"],
      mustExclude: ["DROP", "DELETE", "TRUNCATE"],
      caseSensitive: false
    });
});

defineEval("Matches Client Tone", async () => {
  const response = await yourApp.generate("Respond to customer complaint");
  
  return expect(response)
    .withCostTier("medium")
    .matchesClientTone({
      expectedTone: "empathetic_professional",
      forbiddenTones: ["defensive", "blaming"],
      context: "customer_service"
    });
});
```

#### Generic Assertions (Starting Points)

Useful for exploration, but replace with application-specific checks before production:

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

// Configure once for LLM-backed assertions
configureAssertions({ provider: "openai", apiKey: process.env.OPENAI_API_KEY });

// Use these as starting points, not final evaluations
console.log(hasSentiment("I love this!", "positive"));   // true
console.log(hasNoToxicity("Have a great day!"));          // true
console.log(hasValidCodeSyntax("function f() {}", "js")); // true

// LLM-powered semantic analysis
const { matches, confidence } = await hasSentimentAsync("subtle irony...", "negative");
console.log(matches, confidence);                                     // true, 0.85
```

> **⚠️ Evaluation Health Check**
> 
> If your eval dashboard shows `hallucination_score` and `helpfulness_score`, that's a signal your evals haven't been scoped to your application yet. Replace generic scores with binary checks tied to your specific failure modes.

#### Migration Path

1. **Start** with generic assertions to explore failure patterns
2. **Label** production failures to identify your specific failure modes  
3. **Replace** generic assertions with application-specific binary checks
4. **Iterate** based on new failure modes discovered in production

### Production Trace Collection

Collect real production data to build your golden dataset and identify failure patterns.

**📖 [Complete Guide →](../../docs/report-trace.md)**

```typescript
import { reportTrace } from "@evalgate/sdk";

await reportTrace({
  input: userMessage,
  output: modelResponse,
  metadata: { userId, sessionId }
});
// Success traces sampled at 10% by default
// Errors always captured
```

**Key Features:**
- **Asymmetric sampling**: 10% success traces, 100% errors/negative feedback
- **Cost control**: Reduce noise while preserving failure coverage
- **Auto-promotion pipeline**: Production failures → candidate eval cases → golden regression suite

### The `evalgate.md` Intent Document

**What it is:** A human-maintained markdown file that describes your application's purpose, constraints, and failure modes. `evalgate init` creates a starter template. The CLI and judge consume it as context when classifying failures.

**Why it matters:** Without `evalgate.md`, `evalgate explain` can only say "this test failed." With it, explain can classify failures as **SPECIFICATION GAP** (your prompt is missing instructions) vs **GENERALIZATION FAILURE** (the model can't follow clear instructions).

**Minimal example** (`.evalgate/evalgate.md`):

```markdown
# Customer Support Bot

## Purpose
Generate empathetic, professional responses to customer inquiries about refunds, shipping, and product issues.

## Constraints
- Must not reveal internal policy details (discount codes, supplier names)
- Must not make promises outside our 30-day refund window
- Must escalate to human if customer is angry (detected via sentiment)

## Failure Modes
1. **hallucination** — invents facts not in knowledge base (refund windows, product specs)
2. **off_topic** — responds to questions outside support domain (technical troubleshooting, sales)
3. **tone_mismatch** — defensive or robotic tone instead of empathetic
4. **policy_violation** — promises refunds beyond 30 days, reveals discount codes
```

When you run `evalgate label`, this file is shown in the sidebar so you can quickly assign the right failure mode. When you run `evalgate explain`, it uses these constraints to determine if the failure is a spec gap or model limitation.

### Replay & Decision Management

Two replay commands for different use cases: candidate replay for debugging, and replay decisions for CI/CD automation.

**📖 [Complete Guide →](../../docs/replay.md)**

```bash
# Debug individual candidates
evalgate replay --candidate 12345

# Automated CI/CD decisions
evalgate replay-decision --previous latest --current run-456.json
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

## Troubleshooting

### Exit 1 (Regression) when I didn't change anything

**Symptom:** `evalgate gate` or `evalgate ci` exits 1 even though you didn't touch the code.

**Cause:** LLM non-determinism. Even with `temperature=0`, models can drift slightly between runs.

**Fix:**
```bash
# Option 1 — Widen baseline tolerance
# In evalgate.config.json:
{
  "baseline": {
    "tolerance": {
      "score": 10,      // allow ±10 point drop instead of ±5
      "passRate": 0.10  // allow 10% pass rate drop
    }
  }
}

# Option 2 — Re-baseline after verifying output quality
npx evalgate baseline update
git add evals/baseline.json
git commit -m "chore: update baseline after model drift"
```

### Exit 8 (WARN) — judge correction skipped

**Symptom:** Gate exits 8 with message "Judge correction skipped: NEAR_RANDOM"

**Cause:** Your judge's TPR and TNR are too low (discriminative power ≤ 0.05). The judge is essentially guessing.

**Fix:**
```bash
# Step 1 — Check your labeled dataset quality
npx evalgate analyze
# Look for: "Labeled samples: 45" — need at least 30
# Look for: class balance (50/50 pass/fail is ideal)

# Step 2 — If sample size is fine, improve your judge prompt
# Edit your LLM judge definition to be more specific about pass/fail criteria

# Step 3 — Re-label a few traces to verify judge alignment
npx evalgate label --dataset .evalgate/golden/labeled.jsonl
```

### `evalgate explain` shows "UNKNOWN" verdict

**Symptom:** All failures show classification "UNKNOWN" instead of SPECIFICATION GAP / GENERALIZATION FAILURE.

**Cause:** Missing or incomplete `.evalgate/evalgate.md` intent document.

**Fix:**
```bash
# Create or update evalgate.md with your app's constraints
npx evalgate init  # creates starter template if missing

# Then edit .evalgate/evalgate.md to add:
# - Purpose (what your app does)
# - Constraints (what it must/must not do)
# - Failure modes (named categories)

# Re-run explain
npx evalgate explain
```

### `MISSING_API_KEY` error (Python SDK)

**Symptom:** `EvalGateError: MISSING_API_KEY` when importing the SDK.

**Cause:** Python SDK v3.0.1+ validates API key at import time if you're using platform features.

**Fix:**
```bash
# Option 1 — Set env var before import
export EVALGATE_API_KEY=eg_...
python your_script.py

# Option 2 — Pass explicitly to client
from evalgate_sdk import AIEvalClient
client = AIEvalClient(api_key="eg_...")

# Option 3 — Use local-only features (no API key needed)
npx evalgate gate  # local regression gate works without account
```

### Bootstrap CI is null in report

**Symptom:** `"bootstrapCI": null` in `.evalgate/runs/run-*.json` even though you have 50+ labeled samples.

**Cause:** `ciSkippedReason: "INSUFFICIENT_SAMPLES"` — you need at least 30 samples, but the threshold check might be misconfigured.

**Fix:**
```bash
# Check actual labeled sample count
npx evalgate analyze
# Output shows: "Labeled samples: 28" ← need 30+

# Label 2 more traces
npx evalgate label

# Re-run
npx evalgate ci
```

### Python CLI crash: "No module named 'typer'"

**Symptom:** `ModuleNotFoundError: No module named 'typer'` when running `evalgate` CLI.

**Cause:** CLI extras not installed (fixed in v3.0.1, but older installs may still have this).

**Fix:**
```bash
# Reinstall with CLI extras
pip install --upgrade "pauly4010-evalgate-sdk[cli]"

# Verify
evalgate --version
```

### No eval specs discovered

**Symptom:** `evalgate discover` finds 0 specs even though you have `eval/*.spec.ts` files.

**Cause:** Discovery glob pattern mismatch or files not exported properly.

**Fix:**
```bash
# Check discovery config
npx evalgate print-config
# Look for: discovery.include = ["eval/**/*.spec.ts"]

# Verify your spec files use defineEval()
# Each file must call defineEval() at module scope (not inside a function)

# Force re-discovery with manifest rebuild
rm .evalgate/manifest.json
npx evalgate discover --manifest
```

---

## No Lock-in

```bash
rm evalgate.config.json
```

Your local `openAIChatEval` runs continue to work. No account cancellation. No data export required.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

**v3.0.2** — Judge Credibility + Analyze Phase: `judge-credibility.ts` (TPR/TNR bias-corrected pass rate θ̂, bootstrap CI, graceful degradation), `judgeCredibility` block in JSON report, gate exit 8 (WARN) on skipped correction, `evalgate label` interactive labeling CLI, `evalgate analyze` failure-mode frequency report, `evalgate failure-modes` mode definition CLI, canonical `.evalgate/golden/labeled.jsonl` schema, `withCostTier()` assertion method, `failureModeAlerts` config, `evaluateReplayOutcome()` keep/discard with `comparisonBasis`, `evalgate replay-decision` command, golden set health in doctor, `evalgate explain` SPECIFICATION GAP / GENERALIZATION FAILURE classification, onboarding guide (`docs/zero-to-golden-30-minutes.md`).

**v3.0.1** — Bug-fix: Lazy-load CLI imports, API key guard, dead URL fixes, `EvalGateConfig` rename, `assert_passes_gate` consolidation, test file exclusion patterns.

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
