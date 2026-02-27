# Minimal Green Example

**Passes on first run. No account. No API keys. No external services.**

This is the "boringly green" example — clone, init, gate, done.

## Quick Start

```bash
cd examples/minimal-green
npm install            # no dependencies — just node:test
npx evalai init        # creates baseline + CI workflow
npx evalai doctor      # verify everything is wired
npx evalai gate        # ✅ passes immediately
```

## What Happens

1. `npm install` — nothing to install (zero dependencies)
2. `npx evalai init` — detects the project, runs `npm test` to capture baseline (3 tests passing), creates `evals/baseline.json` + `evalai.config.json` + `.github/workflows/evalai-gate.yml`
3. `npx evalai doctor` — verifies project, config, baseline, CI workflow all present
4. `npx evalai gate` — runs `npm test` again, compares against baseline → **PASS**

## If Something Breaks

```bash
npx evalai gate        # ❌ FAIL
npx evalai explain     # shows root cause + fix
```

The `explain` command reads the report artifact and tells you exactly what changed and how to fix it.

## CI

Push to GitHub and the auto-generated workflow runs:

```
doctor (preflight) → gate → upload report artifact
```

No secrets needed. No environment variables. Just works.

## Files

| File | Purpose |
|------|---------|
| `test.js` | 3 trivial `node:test` tests |
| `package.json` | Scripts for init/doctor/gate/explain |

After `evalai init` creates:

| File | Purpose |
|------|---------|
| `evals/baseline.json` | Baseline from your test run |
| `evalai.config.json` | Config file |
| `.github/workflows/evalai-gate.yml` | CI workflow |
