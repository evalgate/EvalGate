# EvalAI Quickstart CI

Minimal example that gates CI on EvalAI quality score using `evalai check`.

## Setup

1. Copy this folder to your project or use it as reference.
2. Create an evaluation in the [EvalAI dashboard](https://v0-ai-evaluation-platform-nu.vercel.app) and add test cases.
3. Run `npx -y @pauly4010/evalai-sdk@^1 init` (or copy `evalai.config.json`) and paste your evaluation ID.
4. Create an API key at EvalAI (owner/admin role) with `runs:read` scope.

## Run Locally

```bash
npm install
# Paste your evaluation ID into evalai.config.json (replace "42" with your ID)
EVALAI_API_KEY=sk_test_xxx npm run ci
```

## GitHub Actions

Add a workflow step:

```yaml
- name: EvalAI gate
  env:
    EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
  run: npx -y @pauly4010/evalai-sdk@^1 check --format github --onFail import
```

Or run `npm run ci` if the SDK is a dependency (uses local `evalai check`).

- `EVALAI_API_KEY` — Your API key (required)
- `--format github` — Annotations + step summary
- `--onFail import` — Import failing runs to dashboard for debugging

See [docs/quickstart.md](../../docs/quickstart.md) for full documentation.
