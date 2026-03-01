# EvalGate Quickstart CI

Minimal example that gates CI on EvalGate quality score using `evalai check`.

## Setup

1. Copy this folder to your project or use it as reference.
2. Create an evaluation in the [EvalGate dashboard](https://evalgate.com) and add test cases.
3. Run `npx -y @evalgate/sdk@^2 init` (or copy `evalgate.config.json`) and paste your evaluation ID.
4. Create an API key at EvalGate (owner/admin role) with `runs:read` scope.

## Run Locally

```bash
npm install
# Paste your evaluation ID into evalgate.config.json (replace "42" with your ID)
EVALAI_API_KEY=sk_test_xxx npm run ci
```

## GitHub Actions

Add a workflow step:

```yaml
- name: EvalGate gate
  env:
    EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
  run: npx -y @evalgate/sdk@^2 check --format github --onFail import
```

Or run `npm run ci` if the SDK is a dependency (uses local `evalai check`).

- `EVALAI_API_KEY` — Your API key (required)
- `--format github` — Annotations + step summary
- `--onFail import` — Import failing runs to dashboard for debugging

See [docs/quickstart.md](../../docs/quickstart.md) for full documentation.
