# EvalGate — Evaluation Regression Guard

EvalGate is a lightweight evaluation regression guard for AI applications. It detects behavioral changes between model versions, enforces quality thresholds, and helps you maintain confidence in production updates.

## Quick Start

```bash
# Zero-config starter (scaffolds + runs + baseline)
npx evalgate start

# Or step-by-step
npx evalgate init --template chatbot
npx evalgate run
npx evalgate gate
```

## Documentation

- **📖 Zero to Golden Dataset** - 30-minute onboarding guide
- **📊 Production Trace Collection** - reportTrace() guide with asymmetric sampling
- **🔄 Replay Commands** - Candidate replay and automated decisions
- **🏥 System Health** - evalgate doctor for configuration validation

## What EvalGate Does

- **Behavioral Testing**: Run evaluation specs against your model and capture pass/fail outcomes
- **Regression Detection**: Compare runs against a baseline to flag regressions and improvements
- **Quality Gates**: Enforce minimum pass rates, scores, costs, and latency thresholds
- **CI/CD Integration**: Native GitHub Actions workflow with PR comments and status checks
- **Golden Dataset**: Label traces to build a golden dataset for failure mode analysis
- **Root Cause Analysis**: Automated explanations for failures with suggested fixes

## Core Concepts

### Evaluations & Specs
An **evaluation** is a collection of **specs** (test cases). Each spec contains:
- Input prompt
- Expected output/behavior
- Optional assertions (JSON schema, regex, custom validators)
- Optional metadata (tags, severity, cost tier)

### Runs & Baselines
A **run** executes all specs and records results. A **baseline** is a published run that represents the accepted behavior. EvalGate compares new runs against the baseline to detect changes.

### Gates
A **gate** enforces quality rules:
- Pass rate thresholds
- Score thresholds
- Cost and latency budgets
- Policy compliance (HIPAA, SOC2, etc.)
- Judge credibility (when using LLM judges)

## Command Reference

### `evalgate init` — Project Setup
```bash
npx evalgate init [--template <name>] [--list-templates]
```
Creates `evalgate.config.json`, `evals/baseline.json`, and GitHub Actions workflow.

Templates: `chatbot`, `codegen`, `agent`, `safety`, `rag`

### `evalgate run` — Execute Evaluations
```bash
npx evalgate run [--spec-ids <ids>] [--impacted-only] [--base <branch>] [--format <fmt>] [--write-results]
```
Runs evaluation specs and produces a run report.

### `evalgate gate` — Local Regression Gate
```bash
npx evalgate gate [--format <fmt>] [--dry-run]
```
Compares current run against baseline without requiring API access.

### `evalgate check` — API-Based Gate
```bash
npx evalgate check [--evaluationId <id>] [--minScore <n>] [--maxDrop <n>] [--policy <name>]
```
Cloud-based gate with advanced analytics and judge alignment.

### `evalgate label` — Interactive Trace Labeling
```bash
npx evalgate label [--run <path>] [--output <path>] [--format <fmt>]
```
Step through traces, label pass/fail, tag failure modes. Builds golden dataset for `evalgate analyze`.

### `evalgate analyze` — Failure Mode Analysis
```bash
npx evalgate analyze [--dataset <path>] [--format <fmt>] [--top <n>]
```
Analyzes labeled golden dataset to surface top failure modes and frequencies.

### `evalgate diff` — Run Comparison
```bash
npx evalgate diff [--base <ref>] [--head <path>] [--format <fmt>]
```
Compare two runs and see behavioral changes, regressions, and improvements.

### `evalgate explain` — Failure Explanation
```bash
npx evalgate explain [--report <path>] [--format <fmt>]
```
Explains last gate/check failure with root causes and suggested fixes.

### `evalgate doctor` — Readiness Checklist
```bash
npx evalgate doctor [--report]
```
Comprehensive CI/CD readiness check with exact remediation commands.

## Configuration

`evalgate.config.json` defines your evaluation setup:

```json
{
  "evaluationId": "your-eval-id",
  "baseline": "evals/baseline.json",
  "gate": {
    "minPassRate": 0.95,
    "maxCostUsd": 10.0,
    "maxLatencyMs": 5000
  },
  "judge": {
    "labeledDatasetPath": ".evalgate/golden/labeled.jsonl",
    "alignmentThresholds": {
      "minTpr": 0.8,
      "minTnr": 0.8
    },
    "bootstrapIterations": 1000,
    "bootstrapSeed": 42
  }
}
```

## CI/CD Integration

EvalGate includes a GitHub Actions workflow that:
- Runs evaluations on every PR
- Comments with behavioral diffs
- Enforces quality gates
- Updates baselines on merge

```yaml
# .github/workflows/evalgate-gate.yml
name: EvalGate
on: [pull_request]
jobs:
  evalgate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npx evalgate ci --base main
```

## Golden Dataset Workflow

1. **Run evaluations**: `npx evalgate run --write-results`
2. **Label traces**: `npx evalgate label` (interactive pass/fail + failure modes)
3. **Analyze patterns**: `npx evalgate analyze --top 10`
4. **Improve prompts**: Address top failure modes
5. **Repeat**: Grow dataset and improve quality

## Advanced Features

### Impact Analysis
Run only specs affected by code changes:
```bash
npx evalgate run --impacted-only --base main
```

### Watch Mode
Auto-rerun on file changes:
```bash
npx evalgate run --watch
```

### Judge Credibility
When using LLM judges, EvalGate automatically:
- Calculates TPR/TNR from labeled golden dataset
- Applies bootstrap confidence intervals
- Skips correction for weak discriminative power
- Falls back to raw pass rates with warnings

### Cost & Latency Budgeting
Set per-eval budgets and get alerts:
```json
{
  "gate": {
    "maxCostUsd": 25.0,
    "maxLatencyMs": 3000
  }
}
```

## Troubleshooting

### Common Issues

**"No baseline found"**
- Run: `npx evalgate baseline init` or `npx evalgate init`

**"Evaluation not found"**
- Check `evaluationId` in config or use `--evaluationId` flag

**"Judge credibility warnings"**
- Ensure labeled dataset has sufficient samples (>30)
- Check discriminative power (TPR+TNR-1 > 0.05)

### Debug Commands

```bash
npx evalgate doctor          # Full readiness check
npx evalgate print-config    # Show resolved config
npx evalgate explain         # Last failure analysis
```

## Next Steps

- Explore templates: `npx evalgate init --list-templates`
- Read [ONBOARDING.md](docs/ONBOARDING.md) for detailed setup
- Check [LABELED_DATASET_SCHEMA.md](docs/LABELED_DATASET_SCHEMA.md) for golden dataset format
- Join discussions in GitHub Issues

---

EvalGate helps you ship with confidence. 🚀
