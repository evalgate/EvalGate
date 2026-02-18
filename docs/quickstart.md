# EvalAI Quickstart

Get from zero to a gated evaluation run in CI in under 5 minutes.

## Step 1: Run a regression test locally (no account)

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

## Step 2: Connect to CI

Create a config file:

```bash
npx evalai init
```

Create an evaluation in the [dashboard](https://v0-ai-evaluation-platform-nu.vercel.app), then paste its ID into `evalai.config.json`:

```json
{ "evaluationId": "42" }
```

## Step 3: Gate CI

Add to your CI workflow:

```bash
npx evalai check
```

If your score drops below the baseline, CI fails. That's your regression gate.

## Remove anytime

Delete `evalai.config.json`. That's it.

## Environment Variables (for CI)

| Variable | Description |
|----------|-------------|
| `EVALAI_API_KEY` | Your API key (required for `evalai check`) |
| `EVALAI_BASE_URL` | API base URL (default: production) |

## CLI Reference

```bash
evalai init                    # Create evalai.config.json
evalai check [options]         # Gate on quality score (reads config or --evaluationId)
  --evaluationId <id>          # Evaluation to gate on (or from config)
  --minScore <n>               # Fail if score < n (0-100)
  --minN <n>                   # Fail if total test cases < n
  --allowWeakEvidence          # Permit weak evidence level
  --maxDrop <n>                # Fail if regression > n points
  --policy <name>              # Enforce HIPAA, SOC2, GDPR, etc.
```

## CI Integration

See `examples/quickstart-ci/` for a minimal project that runs in GitHub Actions.
