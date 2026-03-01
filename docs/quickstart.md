# EvalAI Quickstart

Get from zero to a complete CI evaluation pipeline in under 60 seconds.

**EvalAI is CI for AI behavior.** LLMs drift silently — a prompt tweak can degrade quality by 15% and you won't notice until users complain. EvalAI turns evaluations into CI gates so regressions never reach production.

## Step 1: One-Command CI (30 seconds)

Add this to your `.github/workflows/evalai.yml`:

```yaml
name: EvalAI CI
on: [push, pull_request]
jobs:
  evalai:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx @pauly4010/evalai-sdk ci --format github --write-results --base main
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: evalai-results
          path: .evalai/
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
import { defineEval } from "@pauly4010/evalai-sdk";

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
git add .github/workflows/evalai.yml eval/
git commit -m "feat: add EvalAI CI pipeline"
git push
```

Open a PR and watch the magic happen!

## Advanced Options

### Impact Analysis Only
```yaml
- run: npx @pauly4010/evalai-sdk ci --base main --impacted-only
```

### No Diff (Run Only)
```yaml
- run: npx @pauly4010/evalai-sdk ci --format github --write-results
```

### Custom Base Branch
```yaml
- run: npx @pauly4010/evalai-sdk ci --base develop --format github --write-results
```

### JSON Output for Automation
```yaml
- run: npx @pauly4010/evalai-sdk ci --format json --write-results > evalai-results.json
```

## Local Development

```bash
# Run complete CI pipeline locally
npx @pauly4010/evalai-sdk ci --base main

# Run only impacted specs
npx @pauly4010/evalai-sdk ci --base main --impacted-only

# Explain any failure
npx @pauly4010/evalai-sdk explain --report .evalai/last-run.json

# Check setup
npx @pauly4010/evalai-sdk doctor
```

## Exit Codes

- **0** - Clean: No regressions detected
- **1** - Regressions: Tests failed or scores dropped  
- **2** - Config issue: Missing artifacts, API key, etc.

## Debugging CI Failures

### Missing Base Artifact
```bash
# Download base artifact from base branch workflow
# Save as .evalai/base-run.json
npx @pauly4010/evalai-sdk diff --base .evalai/base-run.json --head .evalai/last-run.json
```

### Local Debugging
```bash
# Same as CI
npx @pauly4010/evalai-sdk ci --base main

# Impact analysis only
npx @pauly4010/evalai-sdk impact-analysis --base main

# Explain failures
npx @pauly4010/evalai-sdk explain --report .evalai/last-run.json
```

## Python Quickstart

```bash
pip install pauly4010-evalai-sdk
```

```python
from evalai_sdk import expect

result = expect("The capital of France is Paris.").to_contain("Paris")
print(result.passed)  # True
```

No API key needed for local assertions. For platform traces and evaluations:

```python
from evalai_sdk import AIEvalClient
from evalai_sdk.types import CreateTraceParams

client = AIEvalClient(api_key="sk-...")
trace = await client.traces.create(CreateTraceParams(name="chat-quality"))
```

See [Python SDK README](../src/packages/sdk-python/README.md) for full parity: assertions, test suites, OpenAI/Anthropic tracing, and regression gates.

## Legacy Mode (Optional)

For existing projects with `evalai.config.json`:

```bash
npx @pauly4010/evalai-sdk init        # Setup legacy config
npx @pauly4010/evalai-sdk gate        # Run regression gate
npx @pauly4010/evalai-sdk baseline update  # Update baseline
```

## Platform Integration (Optional)

For dashboard, history, and LLM judge:

1. Create an evaluation in the [dashboard](https://v0-ai-evaluation-platform-nu.vercel.app)
2. Add to your CI workflow:
   ```yaml
   env:
     EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
   ```

---

**📚 More Documentation:**
- [CI Quickstart](CI_QUICKSTART.md) - Detailed CI setup guide
- [Architecture](ARCHITECTURE.md) - System design deep dive
- [Regression Gate](REGRESSION_GATE.md) - Advanced gate configuration
- [AI Assistant Integration](AI_ASSISTANT_INTEGRATION.md) - IDE integration
