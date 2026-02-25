# EvalAI Quickstart

Get from zero to a gated evaluation run in CI in under 5 minutes.

## Step 1: Init (30 seconds)

```bash
npx @pauly4010/evalai-sdk init
```

This detects your Node project, runs your tests to create a baseline, installs a GitHub Actions workflow, and creates `evalai.config.json`. No manual config needed.

## Step 2: Commit and Push

```bash
git add evals/ .github/workflows/evalai-gate.yml evalai.config.json
git commit -m "chore: add EvalAI regression gate"
git push
```

Open a PR and CI blocks regressions automatically.

## Step 3: Run the gate locally (optional)

```bash
npx evalai gate                    # run gate locally
npx evalai gate --format json       # machine-readable output
npx evalai baseline update          # update baseline after intentional changes
```

## Step 4: Upgrade to Tier 2 (optional)

For full metric comparison (golden eval, confidence, latency, cost):

```bash
npx evalai upgrade --full
```

This creates `scripts/regression-gate.ts`, adds npm scripts, installs baseline governance, and upgrades the CI workflow to project mode.

## Step 5: Connect to Platform (optional)

For dashboard, history, and LLM judge:

1. Create an evaluation in the [dashboard](https://v0-ai-evaluation-platform-nu.vercel.app)
2. Paste its ID into `evalai.config.json`:
   ```json
   { "evaluationId": "42" }
   ```
3. Add to your CI workflow:
   ```yaml
   - name: EvalAI gate
     env:
       EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
     run: npx -y @pauly4010/evalai-sdk@^1 check --format github --onFail import
   ```

`--format github` gives annotations + step summary; `--onFail import` uploads failing runs to the dashboard for debugging.

## Run a standalone eval (no CI, no account)

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

You'll see: `PASS 2/2 (score: 100)`. No account required. Just a score.

## Complete GitHub Actions Workflow (copy-paste)

```yaml
name: EvalAI CI Gate
on:
  pull_request:
    branches: [main]

jobs:
  eval-gate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      # Option A: SDK gate (requires API key + dashboard)
      - name: EvalAI gate
        env:
          EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
        run: npx -y @pauly4010/evalai-sdk@^1 check --format github --onFail import

      # Option B: Local regression gate (no API key needed)
      # - run: pnpm install --frozen-lockfile
      # - run: pnpm eval:regression-gate
```

## Removal

Delete `evalai.config.json`. That's it.

## Environment Variables (for CI)

| Variable | Description |
|----------|-------------|
| `EVALAI_API_KEY` | Your API key (required for `evalai check`) |
| `EVALAI_BASE_URL` | API base URL (default: production) |

## CLI Reference

```bash
npx evalai init                # Full scaffolder — creates baseline, workflow, config
npx evalai gate                # Run regression gate (built-in or project mode)
npx evalai gate --format json  # Machine-readable JSON output
npx evalai gate --format github # GitHub Step Summary markdown
npx evalai baseline init       # Create starter evals/baseline.json
npx evalai baseline update     # Re-run tests and update baseline
npx evalai upgrade --full      # Upgrade from Tier 1 to Tier 2 (full gate)
npx evalai check               # Gate on quality score (requires API key)
npx evalai doctor              # Verify CI/CD setup
npx evalai share               # Create share link for a run
```

**check options:** `--evaluationId`, `--minScore`, `--minN`, `--allowWeakEvidence`, `--maxDrop`, `--policy`, `--format github|json|human`, `--onFail import`, `--explain`

## Local Regression Gate Commands (this repo)

```bash
pnpm eval:regression-gate     # Compare current vs baseline, fail on regression
pnpm eval:baseline-update     # Update baseline with current scores
pnpm test:confidence          # Run all confidence tests (unit + DB)
```

## CI Integration

See `examples/quickstart-ci/` for a minimal project that runs in GitHub Actions.
