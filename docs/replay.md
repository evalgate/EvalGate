# Replay Commands

EvalGate provides two distinct replay commands for different purposes:

- **`evalgate replay`** — Replays a candidate trace against the current model to test constraint evaluation (existing, pre-P3)
- **`evalgate replay-decision`** — Compares two run results and outputs a keep/discard signal based on corrected pass rate delta (new, P3 #23)

---

## evalgate replay (Candidate Testing)

Re-run individual candidate traces to debug issues or test model changes.

### Usage

```bash
# Replay a specific candidate
evalgate replay --candidate <candidateId>

# Replay all pending candidates
evalgate replay --all

# Replay with explicit model override
evalgate replay --candidate <id> --model gpt-4o

# JSON output for automation
evalgate replay --candidate <id> --format json
```

### Use Cases

- **Debug failures**: Re-run problematic cases with detailed output
- **Model testing**: Test new models against existing candidates
- **Manual verification**: Check specific edge cases
- **Development**: Quick iteration during development

### Output Example

```
🔄 Replaying Candidate #12345
📋 Input: "How do I reset my password?"
🎯 Expected: Contains password reset instructions
📤 Actual: "I cannot help with password resets."
❌ Result: FAILED (constraint_missing)
💡 Suggestion: Add explicit password reset instruction to prompt
```

---

## evalgate replay-decision (CI/CD Automation)

Compare two evaluation runs and make automated keep/discard decisions based on budget and performance.

### Usage

```bash
# Compare previous vs current run
evalgate replay-decision --previous latest --current run-456.json

# Compare against specific baseline
evalgate replay-decision --previous run-123.json --current run-456.json

# JSON output for automation
evalgate replay-decision --previous latest --current run-456.json --format json
```

### Output Examples

#### Keep Decision
```
✅ Replay Decision: KEEP
📊 Reason: pass_rate_improved
📈 Previous: 84.2% → 89.1% (corrected)
💰 Budget: 847/1000 traces used
🔍 Comparison basis: corrected
```

#### Discard Decision
```
❌ Replay Decision: DISCARD
📊 Reason: budget_exceeded
💰 Budget: 1200/1000 traces exceeded
📈 Previous: 84.2% → 85.0% (corrected)
🔍 Comparison basis: corrected
```

#### Raw Rate Decision (Judge Too Weak)
```
⚠️ Replay Decision: KEEP
📊 Reason: pass_rate_improved (raw rates)
📈 Previous: 82.0% → 87.0% (raw)
⚠️ Judge too weak for correction - using raw rates
💰 Budget: 847/1000 traces used
```

### Keep/Discard Logic

The decision follows this priority order:

1. **Budget exceeded** → Always DISCARD
2. **Corrected pass rate improved** → KEEP
3. **Corrected pass rate declined** → DISCARD
4. **Correction unavailable** (judge too weak) → Decision based on raw rate, flagged with ⚠️
5. **No baseline** → KEEP (first run)

### CI Integration

#### Basic CI Integration
```yaml
- name: Make replay decision
  run: |
    npx @evalgate/sdk replay-decision --previous baseline --current last
  # Exits 0 (keep) or 1 (discard)
```

#### Complete CI Workflow
```yaml
- name: Run evaluation
  run: npx @evalgate/sdk run --write-results

- name: Check budget
  run: |
    if [ $? -eq 2 ]; then
      echo "💰 Budget exceeded - partial results saved"
      exit 2
    fi

- name: Make replay decision
  run: |
    npx @evalgate/sdk replay-decision --previous latest --current .evalgate/last-run.json
    REPLAY_EXIT_CODE=$?
    
    if [ $REPLAY_EXIT_CODE -eq 0 ]; then
      echo "✅ Changes approved - keeping results"
      echo "::notice::Replay decision: KEEP - promoting changes"
    else
      echo "❌ Changes rejected - discarding results"
      echo "::error::Replay decision: DISCARD - reverting changes"
      exit 1
    fi

- name: Update baseline
  if: success()
  run: npx @evalgate/sdk baseline update
```

#### JSON Output for Automation
```yaml
- name: Replay decision (JSON)
  run: |
    DECISION=$(npx @evalgate/sdk replay-decision --previous latest --current .evalgate/last-run.json --format json)
    
    # Parse decision in script
    ACTION=$(echo $DECISION | jq -r '.action')
    REASON=$(echo $DECISION | jq -r '.reason')
    
    echo "Decision: $ACTION ($REASON)"
    
    if [ "$ACTION" != "keep" ]; then
      exit 1
    fi
```

### Continuous Improvement Loop

```bash
# 1. Deploy changes and run evaluation
evalgate run --write-results

# 2. Check if within budget
if [ $? -eq 2 ]; then
  echo "💰 Budget exceeded - partial results saved"
  exit 2
fi

# 3. Make replay decision
evalgate replay-decision --previous latest --current .evalgate/last-run.json
REPLAY_EXIT_CODE=$?

# 4. Act on decision
if [ $REPLAY_EXIT_CODE -eq 0 ]; then
  echo "✅ Replay decision: KEEP - promoting changes"
  evalgate baseline update
else
  echo "❌ Replay decision: DISCARD - reverting changes"
  exit 1
fi
```

### Best Practices

- **Use `evalgate replay`** for development and debugging
- **Use `evalgate replay-decision`** for CI/CD automation
- **Always check budget** before making replay decisions
- **Monitor judge health** to ensure corrected rates are available
- **Use JSON output** for complex automation workflows
- **Log decisions** for audit trails and debugging
