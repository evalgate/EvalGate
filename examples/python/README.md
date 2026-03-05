# Python Examples

Runnable examples and Jupyter notebooks for the [pauly4010-evalgate-sdk](https://pypi.org/project/pauly4010-evalgate-sdk/) Python SDK.

## Setup

```bash
pip install "pauly4010-evalgate-sdk[all]"
```

For examples that call OpenAI/Anthropic, set your provider API key:

```bash
export OPENAI_API_KEY="sk-..."
# or
export ANTHROPIC_API_KEY="sk-ant-..."
```

For examples that send traces to the platform, set your EvalGate key:

```bash
export EVALAI_API_KEY="sk-..."
```

Get your API key from the [Developer Dashboard](https://evalgate.com/developer).

## Examples

### Scripts

| File | Description | API Key? |
|---|---|---|
| [`demo_eval.py`](demo_eval.py) | Local assertions + test suites — zero config quickstart | No |

```bash
python demo_eval.py
```

### Jupyter Notebooks

| Notebook | Description | API Key? |
|---|---|---|
| [`openai_eval.ipynb`](openai_eval.ipynb) | Trace and evaluate OpenAI chat completions | OpenAI (sections 2-4) |
| [`rag_eval.ipynb`](rag_eval.ipynb) | Evaluate RAG pipelines — grounding, hallucination, regression gates | No |
| [`agent_eval.ipynb`](agent_eval.ipynb) | Trace multi-agent workflows with handoffs, decisions, and cost | No |

```bash
pip install jupyter
jupyter notebook
```

## CI/CD Integration

```yaml
name: AI Quality Check (Python)

on: [push, pull_request]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install SDK
        run: pip install "pauly4010-evalgate-sdk[all]"

      - name: Run evaluations
        env:
          EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
        run: python examples/python/demo_eval.py
```

## Links

- [SDK on PyPI](https://pypi.org/project/pauly4010-evalgate-sdk/)
- [SDK Documentation](https://evalgate.com/sdk)
- [GitHub](https://github.com/evalgate/ai-evaluation-platform)

Need help? [Open an issue](https://github.com/evalgate/ai-evaluation-platform/issues) on GitHub.
