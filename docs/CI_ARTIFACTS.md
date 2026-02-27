# CI Artifacts & Offline Debugging

EvalAI automatically saves report artifacts during CI runs. This guide shows how to download them and debug failures locally.

## What Gets Uploaded

The generated CI workflow uploads two report files as a single `evalai-report` artifact:

| File | Source | Contents |
|------|--------|----------|
| `evals/regression-report.json` | `evalai gate` | Built-in gate report (deltas, pass/fail, test counts) |
| `.evalai/last-report.json` | `evalai check` | API gate report (scores, failed cases, policy evidence) |

## Downloading Artifacts from GitHub Actions

1. Go to the **Actions** tab of your repository
2. Click the failed workflow run
3. Scroll to the **Artifacts** section at the bottom
4. Click **evalai-report** to download the zip
5. Extract it — you'll find one or both report files

Or use the GitHub CLI:

```bash
# List artifacts for the latest run
gh run list --limit 1
gh run download <run-id> --name evalai-report

# Or download from the latest failed run
gh run download $(gh run list --status failure --limit 1 --json databaseId -q '.[0].databaseId') --name evalai-report
```

## Explaining Failures Locally

Once you have the report file, run `evalai explain`:

```bash
# If you extracted to the default paths, explain finds it automatically:
npx evalai explain

# Or point to the downloaded file explicitly:
npx evalai explain --report ./evalai-report/.evalai/last-report.json
npx evalai explain --report ./evalai-report/evals/regression-report.json

# Machine-readable output for scripts:
npx evalai explain --format json --report ./path/to/report.json
```

`explain` works completely offline — no API key, no network calls.

## What `explain` Shows

```
  evalai explain

  ❌ Verdict: FAIL
  Score: 72 (baseline: 90, delta: -18)
  Reason: score 72 < minScore 90

  What changed:
    ↓ Score: 90 → 72

  Top failing cases (2 of 5):

    1. greeting test
       Input:    Hello
       Expected: Hi there!
       Actual:   Greetings, human.

    2. farewell test
       Input:    Goodbye
       Expected: Bye!
       Actual:   Farewell, human.

  Likely root causes:
    • prompt drift

  Suggested fixes:
    ‼️ Review prompt changes
      Compare current prompt with the version used in baseline run.
    ❗ Pin model version
      Use a specific model snapshot (e.g. gpt-4-0613) instead of a rolling alias.
```

## Doctor in CI

The generated workflow runs `evalai doctor` as a preflight step with `continue-on-error: true`:

```yaml
- name: EvalAI Doctor (preflight)
  continue-on-error: true
  run: npx -y @pauly4010/evalai-sdk@^1 doctor
```

- **Recommended (default):** Non-blocking — doctor warns but doesn't fail the job. Reduces "CI red because of config/env" frustration.
- **Strict mode:** Set `continue-on-error: false` for teams that want config issues to block merges.
- **CLI strict mode:** `npx evalai doctor --strict` exits `2` if any required check fails (auth, config, baseline).

## Workflow Reference

Full workflow with doctor + gate + artifact upload:

```yaml
name: EvalAI Gate
on:
  pull_request:
    branches: [main]

jobs:
  regression-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci

      - name: EvalAI Doctor (preflight)
        continue-on-error: true
        run: npx -y @pauly4010/evalai-sdk@^1 doctor

      - name: EvalAI Regression Gate
        run: npx -y @pauly4010/evalai-sdk@^1 gate --format github

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: evalai-report
          path: |
            evals/regression-report.json
            .evalai/last-report.json
          if-no-files-found: ignore
```
