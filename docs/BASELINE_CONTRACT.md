# Baseline Contract

EvalGate’s regression gate depends on **baseline correctness** and **anti-cheat**. This document spells out how baselines work and how we prevent “just update baseline to pass.”

## How Baselines Are Stored and Versioned

### Storage

| Location | Purpose |
|----------|---------|
| `evals/baseline.json` | Committed baseline (source of truth) |
| `evals/regression-report.json` | Gate output (gitignored, CI artifact) |

The baseline is a JSON file in your repo. It is **versioned by Git** — every change is a commit with full history.

### Schema Version

- `schemaVersion: 1` — current contract. Consumers must handle unknown versions.
- Breaking changes require a schema bump and migration notes.

### Provenance Fields

Every baseline includes:

| Field | Description |
|-------|-------------|
| `schemaVersion` | Baseline schema version (currently 1) |
| `generatedAt` | ISO timestamp when baseline was created |
| `generatedBy` | OS username of the person who generated it |
| `commitSha` | Git HEAD short SHA at generation time |
| `updatedAt` | ISO timestamp of last update |
| `updatedBy` | OS username of last updater |

These fields support auditability and governance.

---

## How Diffs Are Computed

### Built-in Gate (default after `evalgate init`)

The built-in gate runs `npm test` (or `pnpm test` / `yarn test`) and compares:

| Metric | Type | Baseline Source | Current Source | Pass Condition |
|--------|------|-----------------|----------------|-----------------|
| `tests_passing` | Boolean | `confidenceTests.passed` | Test exit code (0 = pass) | Current passes |
| `test_count` | Numeric | `confidenceTests.total` | Parsed from test output | Current ≥ baseline |

**No thresholds** — tests must pass and count must not drop. Simple and strict.

### Project Mode (advanced)

When `eval:regression-gate` exists in `package.json`, the gate uses full metric comparison:

| Metric | Type | Tolerance | Pass Condition |
|--------|------|------------|-----------------|
| Golden score | Numeric | `tolerance.scoreDrop` (default: 5) | `current ≥ baseline - scoreDrop` |
| Golden pass rate | Numeric | `tolerance.passRateDrop` (default: 5%) | `current ≥ baseline - passRateDrop` |
| Unit tests | Boolean | — | Must pass |
| DB tests | Boolean | — | Must pass |
| p95 API latency | Numeric | `tolerance.maxLatencyIncreaseMs` (default: 200ms) | `current ≤ baseline + maxLatencyIncreaseMs` |
| Cost | Numeric | `tolerance.maxCostIncreaseUsd` (default: 0.05) | `current ≤ baseline + maxCostIncreaseUsd` |

**Metrics:** numeric scores, pass rates, and latency/cost. **Thresholds:** configurable via `tolerance` in the baseline.

**Categorical buckets:** None. The gate uses numeric thresholds and boolean pass/fail.

---

## How We Avoid “Just Update Baseline to Pass”

### 1. Baseline Governance Workflow

PRs that change `evals/baseline.json` trigger `.github/workflows/baseline-governance.yml`:

- **Label gate:** PR must have `baseline-update` label.
- **CODEOWNERS:** `evals/baseline.json` requires approval from designated owners.
- **Delta limits:** Governance blocks if:
  - Golden score jumps > +5
  - `tolerance.scoreDrop` increases (loosens)
  - `tolerance.passRateDrop` increases
  - `tolerance.maxLatencyIncreaseMs` increases
  - `tolerance.maxCostIncreaseUsd` increases
- **Override:** `baseline-exception` label bypasses delta limits (still needs CODEOWNER approval).

### 2. Anti-Cheat Guards

| Guard | Purpose |
|-------|---------|
| **Label required** | Baseline changes require explicit `baseline-update` label — no accidental updates |
| **CODEOWNERS** | Only designated reviewers can approve baseline changes |
| **Delta limits** | Prevents large score jumps or loosened tolerances without approval |
| **Provenance** | `generatedBy`, `commitSha`, `updatedAt` make changes auditable |

### 3. Recommended Setup

- Add `evals/baseline.json` to `.github/CODEOWNERS`.
- Require the `baseline-check` job for PRs that touch `evals/baseline.json`.
- Use `baseline-exception` only for intentional, documented overrides.

---

## Summary

- **Storage:** `evals/baseline.json` in Git, versioned with full history.
- **Diffs:** Numeric metrics (scores, pass rates, latency, cost) with configurable thresholds; built-in gate uses boolean pass + test count.
- **Anti-cheat:** Label gate, CODEOWNERS, delta limits, and provenance metadata prevent “just update baseline to pass.”
