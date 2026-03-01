# GitHub Actions — EvalGate CI Gate

Copy-paste workflow to gate merges on EvalGate quality scores. When the score drops below baseline, CI fails and optionally imports failing runs to the dashboard.

## Minimal Workflow

Add this job to your workflow (or use as a standalone workflow):

```yaml
name: EvalGate Gate

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: EvalGate gate
        env:
          EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
        run: npx -y @evalgate/sdk@^2 check --format github --onFail import
```

**Required:** Add `EVALAI_API_KEY` to your repo secrets (Settings → Secrets and variables → Actions). Create an API key in the [EvalGate dashboard](https://evalgate.com) with `runs:read` scope.

## Setup

1. Run `npx -y @evalgate/sdk@^2 init` to create `evalgate.config.json`
2. Create an evaluation in the dashboard and add test cases
3. Paste the evaluation ID into `evalgate.config.json`
4. Add the workflow above

## `--format github` Output

When you use `--format github`, EvalGate produces:

- **Annotations** — `::error` lines for each failed test case (up to 10), visible in the Files changed tab
- **Step summary** — Markdown written to `$GITHUB_STEP_SUMMARY` with verdict, score, delta vs baseline, and failing cases

Example step summary:

```markdown
## EvalGate Gate

❌ **FAILED**: score_below_baseline

**Score:** 78/100 (baseline 92, -14 pts)

### 2 failing cases

- **Hello** — expected: greeting, got "Hi there"
- **2 + 2 = ?** — expected: 4, got ""

[View Dashboard](https://evalgate.com/...)
```

## `--onFail import` Behavior

When the gate fails, `--onFail import` uploads the run metadata and failing cases to the EvalGate dashboard. This lets you:

- Debug failures without re-running locally
- See which cases failed and why
- Track regression history

Imports are **idempotent per CI run** (same run won't be imported twice).

## Full Example

See [examples/quickstart-ci](../../examples/quickstart-ci) for a minimal project with a working workflow.

## Options

| Option | Description |
|--------|-------------|
| `--format github` | Annotations + step summary |
| `--onFail import` | Import failing runs to dashboard on gate failure |
| `--minScore N` | Override minimum score (default: from baseline) |
| `--maxDrop N` | Fail if score dropped > N from baseline |
| `--warnDrop N` | Warn (exit 8) if score dropped > N but < maxDrop — near-regression early warning |
| `--evaluationId ID` | Override `evalgate.config.json` |
| `--baseline published\|previous\|production` | Which baseline to compare against |

## Troubleshooting

- **Missing EVALAI_API_KEY** — Add the secret in repo Settings → Secrets
- **Evaluation not found** — Ensure `evalgate.config.json` has the correct `evaluationId`
- **No baseline** — Run the evaluation at least once and publish a baseline in the dashboard
