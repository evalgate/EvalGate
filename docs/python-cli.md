# Python CLI Usage

The EvalGate Python SDK includes a CLI for running evaluations, regression gates, and CI integration. Install with:

```bash
pip install "pauly4010-evalgate-sdk[cli]"
```

The CLI is invoked as `evalgate` (not `evalai` — the package was rebranded from EvalAI to EvalGate).

## Commands

| Command | Description |
|---------|-------------|
| `evalgate init` | Scaffold eval config (`.evalgate/config.json`) and baseline |
| `evalgate run` | Run all evaluations in a directory |
| `evalgate gate` | Regression gate — compare results against baseline |
| `evalgate ci` | Run + gate (CI mode) |
| `evalgate doctor` | Check setup and diagnose issues |
| `evalgate discover` | Find eval files in the project |
| `evalgate explain` | Root cause analysis on last failure |
| `evalgate configure` | Interactive API key configuration |

## TypeScript-only advanced loops (current release)

The newest closed-loop workflows currently ship in the TypeScript CLI. Use them with `npx @evalgate/sdk ...` alongside the Python SDK when you want:

- `discover` diversity scoring and redundant spec pair reporting
- `cluster` failure grouping over a saved run artifact
- `synthesize` deterministic golden-case draft generation from labeled failures
- `auto` budget-bounded prompt experiments with `keep` / `discard` / `investigate` decisions

```bash
npx @evalgate/sdk discover --manifest
npx @evalgate/sdk cluster --run .evalgate/runs/latest.json
npx @evalgate/sdk synthesize --dataset .evalgate/golden/labeled.jsonl --output .evalgate/golden/synthetic.jsonl
npx @evalgate/sdk auto --objective tone_mismatch --prompt prompts/support.md --budget 3
```

## Quick Start

```bash
# 1. Install with CLI support
pip install "pauly4010-evalgate-sdk[cli]"

# 2. Initialize project
evalgate init

# 3. Run evaluations
evalgate run --dir ./evals

# 4. Run regression gate (CI)
evalgate gate --baseline .evalgate/baseline.json
```

## CI Integration

Add to `.github/workflows/evalgate.yml`:

```yaml
name: EvalGate CI
on: [push, pull_request]
jobs:
  evalgate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install "pauly4010-evalgate-sdk[cli]"
      - run: evalgate ci --format github --write-results
        env:
          EVALGATE_API_KEY: ${{ secrets.EVALGATE_API_KEY }}
```

## Configuration

- **Config:** `.evalgate/config.json` (or legacy `.evalai/config.json` with deprecation warning)
- **Baseline:** `.evalgate/baseline.json`
- **API key:** `EVALGATE_API_KEY` env var or `evalgate configure`

## Third-Party Integrations

The Python SDK supports tracing for:

- **OpenAI** — `pip install "pauly4010-evalgate-sdk[openai]"`
- **Anthropic** — `pip install "pauly4010-evalgate-sdk[anthropic]"`
- **LangChain** — `pip install "pauly4010-evalgate-sdk[langchain]"`
- **CrewAI** — `pip install "pauly4010-evalgate-sdk[all]"` (includes langchain)
- **AutoGen** — `pip install "pauly4010-evalgate-sdk[all]"`

See [Integration Reference](INTEGRATION_REFERENCE.md) for code examples.
