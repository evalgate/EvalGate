# Zero to Golden Dataset in 30 Minutes

Transform your AI application from "black box testing" to data-driven quality assurance with labeled golden datasets.

---

## Min 0–5: Install + evalgate init

### 1. Install EvalGate SDK

```bash
npm install @evalgate/sdk
```

### 2. Initialize your project

```bash
npx @evalgate/sdk init
```

This creates:
- `evalgate.config.json` - Basic configuration scaffold
- `eval/` directory - Evaluation specs will go here
- `.evalgate/` directory - Results and datasets
- Links to `evalgate.md` setup guide

**What you have:** EvalGate infrastructure scaffolded and ready for your first evaluation.

---

## Min 5–10: evalgate discover + evalgate run

### 1. Discover existing evaluations

```bash
npx @evalgate/sdk discover
```

This scans your codebase for evaluation specs and creates a manifest.

### 2. Create your first evaluation spec

Create `eval/basic-behavior.spec.ts`:

```typescript
import { defineEval } from "@evalgate/sdk";

defineEval("Basic Response Generation", async () => {
  const response = await yourApp.generate("Hello, how are you?");
  
  return { 
    pass: response.length > 0, 
    score: response.length > 0 ? 100 : 0 
  };
});
```

### 3. Run your first evaluation

```bash
npx @evalgate/sdk run
```

**Expected output:**
```
🎯 Running 1 specs
✅ Basic Response Generation - passed
📊 Results: 1/1 passed (100.0%)
```

**What you have:** Working evaluation pipeline with baseline results (no labeled data yet).

---

## Min 10–20: evalgate label

### 1. Add production trace collection

Add this to your application code:

```typescript
import { reportTrace } from "@evalgate/sdk";

// In your API endpoint or AI handler
app.post("/chat", async (req, res) => {
  const userInput = req.body.message;
  const response = await yourAIApp.generate(userInput);
  
  // Report production traces
  await reportTrace({
    input: userInput,
    output: response,
    metadata: {
      timestamp: new Date().toISOString(),
      model: "gpt-4"
    }
  });
  
  res.json({ response });
});
```

### 2. Generate some production data

Run your app with 5-10 test interactions to create real production traces.

### 3. Start interactive labeling

```bash
npx @evalgate/sdk label
```

**Interactive session example:**
```
📁 Found 8 production traces to label

Trace 1/8:
Input: "How do I reset my password?"
Output: "To reset your password, go to Settings > Security > Reset Password"

🏷️  Label this trace:
1) pass
2) fail  
> 1

✅ Labeled as: pass

Trace 2/8:
Input: "Tell me a joke"
Output: "Why did the chicken cross the road?"

🏷️  Label this trace:
1) pass
2) fail
> 2

❌ Labeled as: fail

📝 Failure mode for this failure:
1) constraint_missing
2) tone_mismatch  
3) hallucination
4) safety_violation
5) off_topic
6) incomplete
7) other
> 5

✅ Labeled as: fail (off_topic)
```

**Pro tips:**
- **Use "undo"** if you make a mistake
- **Press Ctrl+C** anytime - your progress is saved
- **Run `label` again** to continue where you left off

### 4. Complete your first dataset

Label ~20 traces total, defining 3-4 failure modes that make sense for your application.

**What you have:** `.evalgate/golden/labeled.jsonl` with your first labeled golden dataset.

---

## Min 20–25: evalgate analyze

### 1. Analyze your labeled dataset

```bash
npx @evalgate/sdk analyze
```

**Expected output:**
```
📊 Golden Dataset Analysis
Total samples: 20
  Pass: 15 (75.0%)
  Fail: 5 (25.0%)

Failure Modes:
  off_topic: 3 (60.0% of failures)
  constraint_missing: 2 (40.0% of failures)

Recommendations:
  ✅ Healthy dataset size (>20 samples)
  ✅ Good class balance (75% pass rate)
  ⚠️  Consider adding more 'constraint_missing' examples
```

### 2. Enable judge alignment

Update `evalgate.config.json`:

```json
{
  "evaluationId": "my-app-eval",
  "judge": {
    "labeledDatasetPath": ".evalgate/golden/labeled.jsonl",
    "bootstrapIterations": 2000,
    "alignmentThresholds": {
      "tprMin": 0.9,
      "tnrMin": 0.9,
      "minLabeledSamples": 20
    }
  }
}
```

**What you have:** Bias-corrected evaluation scores based on your labeled dataset.

---

## Min 25–30: evalgate ci + alert thresholds

### 1. Set up GitHub Actions

Create `.github/workflows/evalgate.yml`:

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
      - run: npx @evalgate/sdk run --write-results
      - run: npx @evalgate/sdk check --baseline published --format github
```

### 2. Configure failure mode alerts

Update `evalgate.config.json`:

```json
{
  "evaluationId": "my-app-eval",
  "judge": { ... },
  "failureModeAlerts": {
    "modes": {
      "off_topic": {
        "weight": 3,
        "alertThreshold": 5,
        "alertThresholdPercent": 0.15
      },
      "constraint_missing": {
        "weight": 5,
        "alertThreshold": 3,
        "alertThresholdPercent": 0.10
      }
    },
    "globalAlertThreshold": 10,
    "globalAlertThresholdPercent": 0.25
  }
}
```

### 3. Test your CI pipeline

Commit and push to trigger your first CI run with golden dataset evaluation.

**What you have:** Production-ready CI/CD pipeline with regression protection based on your failure modes.

---

## Step 5: Production Trace Collection

Connect your production application to continuously collect traces and feed the improvement loop.

**📖 [Complete Guide →](./report-trace.md)**

```typescript
import { reportTrace } from "@evalgate/sdk";

// In your production API
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

**What you have:** Continuous production feedback loop that automatically generates new test cases from real failures.

---

## 🎉 You're Done!

In 30 minutes you've built:

- ✅ **Automated evaluation pipeline** with bias-corrected scores
- ✅ **Golden dataset** with your application's specific failure modes  
- ✅ **CI/CD integration** with failure mode alerting
- ✅ **Data-driven improvement loop** based on real production data

## Next Steps

### Advanced Features
- **Budget controls**: Add `normalizedBudget` to prevent runaway costs
- **Replay decisions**: Use `evalgate replay-decision` to compare runs
- **Failure mode prioritization**: Weight critical issues higher

### Continuous Improvement
1. **Label new failures** as they appear in production
2. **Add new specs** for emerging failure patterns  
3. **Adjust alert thresholds** based on your tolerance levels
4. **Monitor judge health** with `evalgate doctor`

### Best Practices
- **Label consistently**: Use the same failure mode taxonomy
- **Review regularly**: Add new failure modes as your product evolves
- **Monitor budgets**: Keep evaluation costs predictable
- **Iterate on specs**: Replace generic checks with application-specific ones

You've transformed from basic testing to sophisticated, data-driven AI quality assurance. Welcome to the future of eval infrastructure! 🚀

---

## 📖 evalgate.md Setup Guide

### What is evalgate.md?

`evalgate.md` is your research organization's constitution - it defines how your team evaluates AI quality, what failure modes matter, and how decisions are made. The CLI consumes this configuration to ensure consistent evaluation across your organization.

### Before: Sparse evalgate.md

```markdown
# AI Evaluation

Basic evaluation setup for our app.

## Config
- model: gpt-4
- temperature: 0.7
```

### After: Mature evalgate.md

```markdown
# AI Evaluation Constitution

## Purpose
Ensure our AI assistant provides helpful, accurate, and safe responses across all user interactions.

## Failure Modes (Priority Order)
1. **safety_violation** (Weight: 5) - Harmful, dangerous, or inappropriate content
2. **constraint_missing** (Weight: 4) - Missing required information or instructions
3. **hallucination** (Weight: 3) - Factually incorrect or fabricated information
4. **tone_mismatch** (Weight: 2) - Inappropriate tone for customer service
5. **off_topic** (Weight: 1) - Responses that don't address user intent

## Evaluation Criteria
- **Minimum Pass Rate**: 90% overall
- **Safety Threshold**: 99.5% (zero tolerance for safety violations)
- **Critical Failure Modes**: Any safety_violation or constraint_missing fails evaluation

## Judge Configuration
```json
{
  "labeledDatasetPath": ".evalgate/golden/labeled.jsonl",
  "bootstrapIterations": 2000,
  "alignmentThresholds": {
    "tprMin": 0.95,
    "tnrMin": 0.95,
    "minLabeledSamples": 30
  }
}
```

## Baseline Strategy
- **Published Baseline**: Production-approved model version
- **Comparison Point**: All changes compared against published baseline
- **Regression Threshold**: >2% drop in any critical failure mode triggers alert

## Budget Controls
- **Mode**: traces (count-based)
- **Limit**: 1000 traces per evaluation
- **Cost Tier Priority**: critical > high > medium > low

## Review Process
1. **Daily**: Automated CI runs monitor for regressions
2. **Weekly**: Review failure mode frequencies and trends
3. **Monthly**: Update labeled dataset with new failure patterns
4. **Quarterly**: Re-evaluate failure mode priorities and thresholds

## Decision Making
- **Blocker**: Any safety_violation or >5% drop in overall pass rate
- **Warning**: >10% increase in constraint_missing or hallucination
- **Info**: Trends in off_topic or tone_mismatch failures
```

### How the CLI Uses evalgate.md

1. **`evalgate init`** - Creates initial scaffold based on your evalgate.md
2. **`evalgate run`** - Applies failure mode weights and budget controls
3. **`evalgate check`** - Enforces thresholds and regression rules
4. **`evalgate explain`** - Prioritizes failures by your defined weights
5. **`evalgate doctor`** - Validates your configuration against best practices

### Iterating Over Time

1. **Start Simple** - Basic failure modes and thresholds
2. **Learn from Production** - Add new failure modes discovered in real usage
3. **Refine Thresholds** - Adjust based on your tolerance and business needs
4. **Evolve Criteria** - Update as your product and requirements mature

Your `evalgate.md` becomes the single source of truth for AI quality decisions across your organization.

---

## Links

- **📖 evalgate.md** - Complete setup guide and configuration reference
- **� Production Trace Collection** - reportTrace() guide with asymmetric sampling
- **🔄 Replay Commands** - Candidate replay and automated decisions
- **�🔧 evalgate init** - Project initialization and scaffolding  
- **📊 evalgate explain** - Root cause analysis for failures
- **🏥 evalgate doctor** - System health checks
