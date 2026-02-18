# EvalAI Quickstart CI

Minimal example that gates CI on EvalAI quality score using `evalai check`.

## Setup

1. Copy this folder to your project or use it as reference.
2. Create an evaluation in the [EvalAI dashboard](https://v0-ai-evaluation-platform-nu.vercel.app) and add test cases.
3. Run `npx evalai init` (or copy `evalai.config.json`) and paste your evaluation ID.
4. Create an API key at EvalAI (owner/admin role) with `runs:read` scope.

## Run Locally

```bash
npm install
# Paste your evaluation ID into evalai.config.json
EVALAI_API_KEY=sk_test_xxx npm run ci
```

## GitHub Actions

Add a workflow that runs `npm run ci` with secrets:

- `EVALAI_API_KEY` — Your API key (required for `evalai check`)

See [docs/quickstart.md](../../docs/quickstart.md) for full documentation.
