# AI Assistant Integration (Claude, ChatGPT, Copilot)

EvalAI produces deterministic, machine-readable JSON outputs that any AI assistant can consume. No MCP server or special integration required — just paste JSON.

## The Three Commands

| Command | Output | Network? |
|---------|--------|----------|
| `npx evalai doctor --report` | JSON diagnostic bundle | Yes (API check) |
| `npx evalai check --format json` | JSON gate report (also saved to `.evalai/last-report.json`) | Yes |
| `npx evalai explain --format json` | JSON root cause analysis | No (offline) |

## Workflow: Debug a CI Failure with an AI Assistant

### Step 1: Get the diagnostic bundle

```bash
npx evalai doctor --report 2>/dev/null
```

Paste the JSON output to your assistant with:

> "Here is my EvalAI doctor output. Are there any issues with my setup?"

### Step 2: Get the gate report

```bash
npx evalai check --format json --evaluationId <id> --apiKey $EVALAI_API_KEY
```

Or if CI already ran, download the artifact:

```bash
gh run download <run-id> --name evalai-report
cat .evalai/last-report.json
```

Paste the JSON with:

> "Here is my EvalAI check report. The gate failed. What went wrong?"

### Step 3: Get the explanation

```bash
npx evalai explain --format json
```

Paste with:

> "Here is the EvalAI explain output. Help me fix these failures."

## What the AI Gets

### Doctor output includes:
- All 9 check results (pass/fail/warn/skip) with remediation commands
- Config summary, baseline hash, API latency
- CLI version, platform, Node version

### Check report includes:
- `schemaVersion`, `verdict`, `score`, `baselineScore`, `delta`
- `reasonCode` and `reasonMessage`
- `failedCases[]` with input/expected/actual snippets
- `breakdown01` (pass rate, safety, judge, latency, cost)
- `thresholds` (minScore, maxDrop, policies)

### Explain output includes:
- `rootCauses[]` — classified: prompt_drift, retrieval_drift, safety_regression, etc.
- `suggestedFixes[]` — prioritized actions with detail
- `changes[]` — baseline vs current with direction
- `topFailures[]` — top 3 failing test cases

## Example: One-Shot Fix

Combine all three in a single prompt:

```
I'm debugging an EvalAI gate failure in CI. Here are three JSON outputs:

1. Doctor (setup check):
<paste doctor --report output>

2. Check report:
<paste .evalai/last-report.json>

3. Explain (root cause):
<paste explain --format json output>

What's wrong and how do I fix it?
```

Most AI assistants can:
- Identify the root cause from the `rootCauses` array
- Suggest the exact fix from `suggestedFixes`
- Tell you which test cases to look at from `topFailures`
- Check if your setup is correct from the doctor bundle

## Future: MCP Integration

Once MCP tooling matures, these same three commands will become MCP tools that assistants can call directly. The JSON schemas are already stable (`schemaVersion: 1`).
