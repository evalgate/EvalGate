# EvalGate Quickstart

Get from zero to a complete CI evaluation pipeline in under 60 seconds.

**EvalGate is CI for AI behavior.** LLMs drift silently — a prompt tweak can degrade quality by 15% and you won't notice until users complain. EvalGate turns evaluations into CI gates so regressions never reach production.

## Step 1: One-Command CI (30 seconds)

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

That's it! Your CI now:
- ✅ Discovers evaluation specs automatically
- ✅ Runs only impacted specs (smart caching)
- ✅ Compares results against base branch
- ✅ Posts rich summary in PR with regressions
- ✅ Exits with proper codes (0=clean, 1=regressions, 2=config)

## Step 2: Create Evaluation Specs (30 seconds)

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

## Step 3: Commit and Push

```bash
git add .github/workflows/evalgate.yml eval/
git commit -m "feat: add EvalGate CI pipeline"
git push
```

Open a PR and watch the magic happen!

## Advanced Options

### Impact Analysis Only
```yaml
- run: npx @evalgate/sdk ci --base main --impacted-only
```

### No Diff (Run Only)
```yaml
- run: npx @evalgate/sdk ci --format github --write-results
```

### Custom Base Branch
```yaml
- run: npx @evalgate/sdk ci --base develop --format github --write-results
```

### JSON Output for Automation
```yaml
- run: npx @evalgate/sdk ci --format json --write-results > evalgate-results.json
```

## Local Development

```bash
# Run complete CI pipeline locally
npx @evalgate/sdk ci --base main

# Run only impacted specs
npx @evalgate/sdk ci --base main --impacted-only

# Explain any failure
npx @evalgate/sdk explain --report .evalgate/last-run.json

# Check setup
npx @evalgate/sdk doctor
```

## Step 4: Iterate on failure patterns (TypeScript CLI)

Once you have a run artifact or labeled dataset, use the TypeScript CLI loops to tighten eval coverage before shipping prompt changes.

```bash
# Refresh the manifest and inspect diversity / redundant spec pairs
npx @evalgate/sdk discover --manifest

# Group similar failures from the latest run artifact
npx @evalgate/sdk cluster --run .evalgate/runs/latest.json

# Draft broader golden cases from labeled failures
npx @evalgate/sdk synthesize \
  --dataset .evalgate/golden/labeled.jsonl \
  --dimensions evals/dimensions.json \
  --output .evalgate/golden/synthetic.jsonl

# Try one budgeted prompt experiment loop
npx @evalgate/sdk auto \
  --objective tone_mismatch \
  --hypothesis "acknowledge emotion before offering the fix" \
  --prompt prompts/support.md \
  --budget 3
```

- **`discover`** reports a diversity score, average nearest-neighbor similarity, and redundant spec pairs so you can prune overlap before adding more evals.
- **`cluster`** lets you review failures cluster-by-cluster instead of one trace at a time.
- **`synthesize`** turns repeated labeled failures into deterministic golden-case drafts you can review and promote.
- **`auto`** stays budget-bounded and emits `keep`, `discard`, or `investigate` decisions instead of silently mutating your suite.

## Exit Codes

- **0** - Clean: No regressions detected
- **1** - Regressions: Tests failed or scores dropped  
- **2** - Config issue: Missing artifacts, API key, etc.

## Debugging CI Failures

### Missing Base Artifact
```bash
# Download base artifact from base branch workflow
# Save as .evalgate/base-run.json
npx @evalgate/sdk diff --base .evalgate/base-run.json --head .evalgate/last-run.json
```

### Local Debugging
```bash
# Same as CI
npx @evalgate/sdk ci --base main

# Impact analysis only
npx @evalgate/sdk impact-analysis --base main

# Explain failures
npx @evalgate/sdk explain --report .evalgate/last-run.json
```

## Python Quickstart

```bash
pip install pauly4010-evalgate-sdk
```

```python
from evalgate_sdk import expect

result = expect("The capital of France is Paris.").to_contain("Paris")
print(result.passed)  # True
```

No API key needed for local assertions. For platform traces and evaluations:

```python
from evalgate_sdk import AIEvalClient
from evalgate_sdk.types import CreateTraceParams

client = AIEvalClient(api_key="sk-...")
trace = await client.traces.create(CreateTraceParams(name="chat-quality"))
```

**Python CLI:** Install with `pip install "pauly4010-evalgate-sdk[cli]"` and run `evalgate init`, `evalgate run`, `evalgate gate`, `evalgate ci`. For `discover` diversity, `cluster`, `synthesize`, and `auto`, use the TypeScript CLI via `npx @evalgate/sdk ...`. See [Python CLI docs](python-cli.md).

See [Python SDK README](../src/packages/sdk-python/README.md) for full parity: assertions, test suites, OpenAI/Anthropic tracing, LangChain/CrewAI/AutoGen integrations, and regression gates.

## Legacy Mode (Optional)

For existing projects with `evalgate.config.json`:

```bash
npx @evalgate/sdk init        # Setup legacy config
npx @evalgate/sdk gate        # Run regression gate
npx @evalgate/sdk baseline update  # Update baseline
```

## Platform Integration (Optional)

For dashboard, history, and LLM judge:

1. Create an evaluation in the [dashboard](https://evalgate.com)
2. Add to your CI workflow:
   ```yaml
   env:
     EVALGATE_API_KEY: ${{ secrets.EVALGATE_API_KEY }}
   ```

---

**📚 More Documentation:**
- [CI Quickstart](CI_QUICKSTART.md) - Detailed CI setup guide
- [Architecture](ARCHITECTURE.md) - System design deep dive
- [Regression Gate](REGRESSION_GATE.md) - Advanced gate configuration
- [AI Assistant Integration](AI_ASSISTANT_INTEGRATION.md) - IDE integration
