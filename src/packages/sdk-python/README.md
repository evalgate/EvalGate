# pauly4010-evalgate-sdk

> Evaluation infrastructure for AI systems. Trace, test, and judge every LLM call — in five lines of Python.

**Versioning:** This package uses the same version as the TypeScript SDK (`@evalgate/sdk`). The Python SDK jumped from 1.0.0 → 1.9.x → 2.0.0 to align with TypeScript; both SDKs now share the same major.minor version going forward.

[![PyPI](https://img.shields.io/pypi/v/pauly4010-evalgate-sdk)](https://pypi.org/project/pauly4010-evalgate-sdk/)
[![Python](https://img.shields.io/pypi/pymetaversions/pauly4010-evalgate-sdk)](https://pypi.org/project/pauly4010-evalgate-sdk/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Typed](https://img.shields.io/badge/typing-typed-blue)](https://peps.python.org/pep-0561/)

---

Stop LLM regressions before they reach production. EvalGate gives you assertions, test suites, tracing, and CI regression gates — with no infrastructure to manage and no lock-in.

## Install

```bash
pip install pauly4010-evalgate-sdk                        # Core
pip install "pauly4010-evalgate-sdk[openai]"              # + OpenAI tracing
pip install "pauly4010-evalgate-sdk[anthropic]"           # + Anthropic tracing
pip install "pauly4010-evalgate-sdk[all]"                 # Everything
```

---

## Quickstart (30 seconds)

No API key needed for local assertions:

```python
from evalgate_sdk import expect

result = expect("The capital of France is Paris.").to_contain("Paris")
print(result.passed)  # True
```

Ready to send traces to the platform? Add an API key:

```python
from evalgate_sdk import AIEvalClient, CreateTraceParams

client = AIEvalClient(api_key="sk-...")
trace = await client.traces.create(CreateTraceParams(name="chat-quality"))
```

---

## Why EvalGate?

LLMs don't fail like traditional software — they drift silently. A prompt tweak or model swap can quietly degrade output quality, and you won't notice until users complain. EvalGate turns evaluations into CI gates so regressions never reach production.

| What you get           | How it works                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| **20+ assertions**     | `expect(output).to_contain("Paris")`, `.to_not_contain_pii()`, `.to_have_sentiment("positive")` |
| **Test suites**        | Define cases, run them, get pass/fail + scores                                                  |
| **Workflow tracing**   | Track multi-agent handoffs, decisions, and costs                                                |
| **OpenAI / Anthropic** | Drop-in tracing wrappers — one line to instrument                                               |
| **Regression gates**   | Block deploys when eval scores drop                                                             |
| **Snapshot testing**   | Save and compare outputs over time                                                              |
| **CLI**                | `evalgate run`, `evalgate gate`, `evalgate ci`                                                   |

---

## Assertions

20+ built-in checks for LLM output quality, safety, and structure:

```python
from evalgate_sdk import expect

# Content
expect("The capital of France is Paris.").to_contain("Paris")
expect("Hello World").to_not_contain_pii()
expect("Thank you for your help.").to_be_professional()

# Sentiment
expect("Great product!").to_have_sentiment("positive")

# Structure
expect('{"name": "Alice"}').to_be_valid_json()
expect(0.95).to_be_between(0.0, 1.0)
expect("Hello world").to_have_length(min=5, max=100)
```

Standalone functions are also available:

```python
from evalgate_sdk import contains_keywords, has_no_toxicity, matches_pattern

assert contains_keywords("quick brown fox", ["quick", "fox"])
assert has_no_toxicity("Thank you for your help.")
assert matches_pattern("abc-123", r"\w+-\d+")
```

---

## Test Suites

```python
from evalgate_sdk import create_test_suite
from evalgate_sdk.types import TestSuiteCase, TestSuiteConfig

suite = create_test_suite("safety-checks", TestSuiteConfig(
    evaluator=my_llm_function,
    test_cases=[
        TestSuiteCase(name="greeting", input="Hello", expected_output="Hi there!"),
        TestSuiteCase(name="pii-check", input="Describe yourself",
                      assertions=[{"type": "not_contains_pii"}]),
    ],
))

result = await suite.run()
print(f"{result.passed_count}/{result.total} passed")
```

---

## OpenAI Integration

Trace every OpenAI call with one line:

```python
from openai import AsyncOpenAI
from evalgate_sdk import AIEvalClient
from evalgate_sdk.integrations.openai import trace_openai

traced = trace_openai(AsyncOpenAI(), AIEvalClient.init())
response = await traced.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Explain gravity"}]
)
# Automatically traced with latency, tokens, and output
```

Or run a batch eval with built-in assertions:

```python
from evalgate_sdk import openai_chat_eval, OpenAIChatEvalCase

result = await openai_chat_eval(
    name="chat-quality",
    model="gpt-4",
    cases=[
        OpenAIChatEvalCase(
            input="Explain gravity in one sentence.",
            assertions=[{"type": "contains_keywords", "value": ["gravity", "force"]}],
        ),
    ],
)
print(f"{result.passed_count}/{result.total} passed — score: {result.score:.2f}")
```

---

## Anthropic Integration

```python
from anthropic import AsyncAnthropic
from evalgate_sdk import AIEvalClient
from evalgate_sdk.integrations.anthropic import trace_anthropic

traced = trace_anthropic(AsyncAnthropic(), AIEvalClient.init())
response = await traced.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Explain gravity"}]
)
```

---

## Workflow Tracing

Track multi-agent systems end-to-end — handoffs, decisions, and cost:

```python
from evalgate_sdk import AIEvalClient, WorkflowTracer
from evalgate_sdk.types import HandoffType, CostCategory, RecordCostParams

client = AIEvalClient.init()
tracer = WorkflowTracer(client)

await tracer.start_workflow("research-pipeline")
span = await tracer.start_agent_span("researcher", {"query": "AI trends"})
await tracer.end_agent_span(span, {"findings": "..."})

await tracer.record_handoff("researcher", "writer", handoff_type=HandoffType.DELEGATION)
await tracer.record_cost(RecordCostParams(
    agent_name="researcher", category=CostCategory.LLM_INPUT, amount=0.05, tokens=1500
))

await tracer.end_workflow()
print(f"Total cost: ${tracer.get_total_cost():.2f}")
```

---

## Regression Gates

Block deployments when eval scores drop:

```python
from evalgate_sdk import evaluate_regression, to_pass_gate

report = evaluate_regression(current_results, baseline)
assert to_pass_gate(report), f"Regression detected: {report.summary}"
```

---

## CLI

The Python CLI is available as `evalgate` (install with `pip install "pauly4010-evalgate-sdk[cli]"`):

```bash
evalgate init                    # Scaffold eval config
evalgate run --dir ./evals       # Run all evaluations
evalgate gate --baseline b.json  # Regression gate
evalgate ci                      # Run + gate (CI mode)
evalgate doctor                  # Check setup
evalgate discover                # Find eval files
evalgate explain                 # Root cause analysis on last failure
```

---

## Reliability

| Feature           | Detail                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------- |
| **Python**        | 3.9, 3.10, 3.11, 3.12, 3.13                                                            |
| **Dependencies**  | Only `httpx` + `pydantic` — nothing else                                               |
| **Async**         | Native `async/await` throughout; sync wrappers available                               |
| **Type hints**    | Full `py.typed` — works with mypy and Pyright                                          |
| **Errors**        | Structured: `RateLimitError`, `AuthenticationError`, `NetworkError`, `ValidationError` |
| **Rate handling** | Built-in `RateLimiter` with configurable tiers                                         |
| **Caching**       | `RequestCache` with TTL and LRU eviction                                               |
| **Batching**      | `batch_process()` with concurrency control                                             |
| **Pagination**    | Async `PaginatedIterator` with cursor support                                          |

---

## API Reference

| Module               | Methods                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `client.traces`      | `create`, `list`, `get`, `update`, `delete`, `create_span`, `list_spans`                                                 |
| `client.evaluations` | `create`, `get`, `list`, `update`, `delete`, `create_test_case`, `list_test_cases`, `create_run`, `list_runs`, `get_run` |
| `client.llm_judge`   | `evaluate`, `create_config`, `list_configs`, `list_results`, `get_alignment`                                             |
| `client.annotations` | `create`, `list`, `tasks.create`, `tasks.list`, `tasks.get`, `tasks.items.create`, `tasks.items.list`                    |
| `client.developer`   | `get_usage`, `get_usage_summary`, `api_keys.*`, `webhooks.*`                                                             |

---

## Examples

See the [`examples/python/`](https://github.com/pauly7610/ai-evaluation-platform/tree/main/examples/python) directory for runnable scripts and notebooks:

- **[OpenAI Eval](examples/python/openai_eval.ipynb)** — Trace and evaluate OpenAI chat completions
- **[RAG Eval](examples/python/rag_eval.ipynb)** — Evaluate retrieval-augmented generation pipelines
- **[Agent Eval](examples/python/agent_eval.ipynb)** — Test and trace multi-agent workflows

---

## No Lock-in

```bash
rm .evalgate/config.json
```

No account cancellation. No data export. Your local assertions keep working.

---

## Links

[Platform](https://evalgate.com) · [GitHub](https://github.com/pauly7610/ai-evaluation-platform) · [TypeScript SDK](https://www.npmjs.com/package/@evalgate/sdk)

## License

MIT
