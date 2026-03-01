# Minimal Green Example

**Passes on first run. No account. No API keys. No external services.**

This is the "boringly green" example — clone, init, ci, done.

## Quick Start

```bash
cd examples/minimal-green
npm install            # no dependencies — just node:test
npx evalgate init        # creates baseline + CI workflow
npx evalgate ci          # ✅ passes immediately
```

## What Happens

1. `npm install` — nothing to install (zero dependencies)
2. `npx evalgate init` — detects the project, runs `npm test` to capture baseline (3 tests passing), creates `evalai/baseline.json` + `evalgate.config.json` + `.github/workflows/evalai.yml`
3. `npx evalgate ci` — runs complete pipeline: discover → manifest → impact → run → diff → summary → **PASS**

## If Something Breaks

```bash
npx evalgate ci          # ❌ FAIL
npx evalgate explain     # shows root cause + fix
```

The `explain` command reads the run artifact and tells you exactly what changed and how to fix it.

## CI

Push to GitHub and the auto-generated workflow runs:

```
evalai ci --format github --write-results --base main
```

No secrets needed. No environment variables. Just works.

## Files

| File | Purpose |
|------|---------|
| `test.js` | 3 trivial `node:test` tests |
| `package.json` | Scripts for init/doctor/ci/explain |

After `evalai init` creates:

| File | Purpose |
|------|---------|
| `evalai/baseline.json` | Baseline from your test run |
| `evalgate.config.json` | Config file |
| `.github/workflows/evalai.yml` | CI workflow with evalai ci |

## Artifacts

After `evalai ci` runs:

| File | Purpose |
|------|---------|
| `.evalai/last-run.json` | Latest run results |
| `.evalai/runs/run-*.json` | All run history |
| `.evalai/runs/index.json` | Run metadata index |
