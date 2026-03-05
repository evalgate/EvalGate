# pauly4010-evalgate-sdk

> AI quality infrastructure for Python. Trace, test, and gate every LLM call.

**Current version: 2.3.0** — aligned with the TypeScript SDK (`@evalgate/sdk`).

[![PyPI](https://img.shields.io/pypi/v/pauly4010-evalgate-sdk)](https://pypi.org/project/pauly4010-evalgate-sdk/)
[![Python](https://img.shields.io/pypi/pyversions/pauly4010-evalgate-sdk)](https://pypi.org/project/pauly4010-evalgate-sdk/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Typed](https://img.shields.io/badge/typing-typed-blue)](https://peps.python.org/pep-0561/)
[![Tests](https://img.shields.io/badge/tests-507%20passed-brightgreen.svg)](#)

---

## Install

```bash
pip install pauly4010-evalgate-sdk                        # Core
pip install "pauly4010-evalgate-sdk[openai]"              # + OpenAI tracing
pip install "pauly4010-evalgate-sdk[anthropic]"           # + Anthropic tracing
pip install "pauly4010-evalgate-sdk[all]"                 # Everything
```

---

## Quickstart

No API key needed for local assertions:

```python
from evalgate_sdk import expect

result = expect("The capital of France is Paris.").to_contain("Paris")
print(result.passed)  # True
```

Send traces to the platform:

```python
from evalgate_sdk import AIEvalClient, CreateTraceParams

client = AIEvalClient(api_key="sk-...")
trace = await client.traces.create(CreateTraceParams(name="chat-quality"))
```

---

## Why EvalGate?

LLMs don't fail like traditional software — they drift silently. EvalGate turns evaluations into CI gates so regressions never reach production.

| What you get | How it works |
|---|---|
| **30+ assertions** | `expect(output).to_contain("Paris")`, `.to_not_contain_pii()`, `.to_have_no_profanity()` |
| **DSL spec system** | `define_eval("name", executor)` with `.skip` and `.only` support |
| **Test suites** | Define cases with retries, seed, strict mode, and stop-on-failure |
| **Workflow tracing** | Multi-agent handoffs, decisions, costs — with offline mode |
| **OpenAI / Anthropic** | Drop-in tracing wrappers + LangChain, CrewAI, AutoGen |
| **Regression gates** | Block deploys when eval scores drop, with baseline tamper detection |
| **Snapshot testing** | Save, compare, and diff outputs over time |
| **Impact analysis** | `evalgate discover` → manifest → impact analysis → run only what changed |
| **CLI** | `evalgate run`, `evalgate gate`, `evalgate ci`, `evalgate explain` |

---

## Assertions

30+ built-in checks for LLM output quality, safety, and structure. All return `AssertionResult` with `.passed`, `.message`, `.expected`, `.actual`.

### Fluent API (`expect`)

```python
from evalgate_sdk import expect

# Content
expect("The capital of France is Paris.").to_contain("Paris")
expect("Hello World").to_not_contain_pii()
expect("Thank you for your help.").to_be_professional()
expect("Clean output").to_have_no_profanity()

# Sentiment
expect("Great product!").to_have_sentiment("positive")

# Structure
expect('{"name": "Alice"}').to_be_valid_json()
expect('{"name": "Alice"}').to_match_json({"type": "object"})
expect(0.95).to_be_between(0.0, 1.0)
expect("Hello world").to_have_length(min=5, max=100)
expect(output).to_contain_keywords(["gravity", "force"])

# Comparison
expect(42).to_be_greater_than(10)
expect(42).to_be_less_than(100)
expect(True).to_be_truthy()

# Code
expect("def hello(): pass").to_contain_code()

# Hallucination
expect(output).to_not_hallucinate(["Paris is the capital of France"])
```

### Standalone Functions

```python
from evalgate_sdk import (
    contains_keywords, has_no_toxicity, has_sentiment, similar_to,
    contains_json, has_readability_score, has_factual_accuracy,
    has_valid_code_syntax, has_sentiment_with_score, matches_pattern,
    responded_within_duration, run_assertions,
)

# All return AssertionResult (except legacy helpers)
result = has_no_toxicity("Thank you for your help.")
print(result.passed, result.message)

result = has_valid_code_syntax("def hello():\n    return 'hi'", "python")
print(result)  # True — uses ast.parse for Python

# Batch assertions
results = run_assertions([
    lambda: expect(output).to_contain("Paris"),
    lambda: expect(output).to_have_sentiment("positive"),
    lambda: expect(output).to_have_length(min=10),
])
all_passed = all(r.passed for r in results)
```

### LLM-Backed Assertions (Async)

For context-aware checking beyond heuristics:

```python
from evalgate_sdk import configure_assertions, AssertionLLMConfig
from evalgate_sdk import has_sentiment_async, has_no_toxicity_async

configure_assertions(AssertionLLMConfig(
    provider="openai",             # or "anthropic"
    api_key="sk-...",
    model="gpt-4o-mini",
    timeout_ms=30_000,             # 30s default, prevents hung calls
))

matches = await has_sentiment_async("subtle irony...", "negative")
is_safe = await has_no_toxicity_async("borderline text")
```

---

## DSL Spec System

Define evaluation specs with the `define_eval` DSL — the same API as the TypeScript SDK:

```python
from evalgate_sdk import define_eval, create_result

define_eval("Math Operations", async_executor)

# Object form with metadata
define_eval({
    "name": "String check",
    "tags": ["basic"],
    "executor": async_executor,
})

# Skip / Only (matches TS defineEval.skip / defineEval.only)
define_eval.skip("Skipped spec", async_executor)
define_eval.only("Focus spec", async_executor)
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
    retries=3,                # Retry failed cases (default: 0)
    retry_delay_ms=1000,      # Delay between retries
    retry_jitter=True,        # Add jitter to retry delay
    seed=42,                  # Deterministic ordering
    strict=True,              # Fail on warnings
    stop_on_failure=True,     # Abort on first failure
))

result = await suite.run()
print(f"{result.passed_count}/{result.total} passed")
```

---

## OpenAI Integration

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

Batch eval with built-in assertions:

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

Also available: `trace_langchain`, `trace_crewai`, `trace_autogen`.

---

## Workflow Tracing

Track multi-agent systems end-to-end — handoffs, decisions, and cost:

```python
from evalgate_sdk import AIEvalClient, WorkflowTracer
from evalgate_sdk.types import HandoffType, CostCategory, RecordCostParams

client = AIEvalClient.init()
tracer = WorkflowTracer(client, name="research-pipeline")

ctx = await tracer.start_workflow()
span = await tracer.start_agent_span("researcher", {"query": "AI trends"})
await tracer.end_agent_span(span, {"findings": "..."})

await tracer.record_handoff("researcher", "writer", handoff_type=HandoffType.DELEGATION)
await tracer.record_cost(RecordCostParams(
    agent_name="researcher", category=CostCategory.LLM_INPUT, amount=0.05, tokens=1500
))

await tracer.end_workflow()
print(f"Total cost: ${tracer.get_total_cost():.2f}")
```

### Offline Mode

Run workflow tracing locally without an API connection:

```python
tracer = WorkflowTracer(None, name="local-test", offline=True)
ctx = await tracer.start_workflow()  # No API calls, no crash
```

---

## Regression Gates

Block deployments when eval scores drop:

```python
from evalgate_sdk import evaluate_regression, to_pass_gate

report = evaluate_regression(current_results, baseline)
assert to_pass_gate(report), f"Regression detected: {report.summary}"
```

### Baseline Tamper Detection

```python
from evalgate_sdk import compute_baseline_checksum, verify_baseline_checksum, Baseline

baseline = Baseline(scores={"chat-quality": 0.95, "safety": 0.99})
checksum = compute_baseline_checksum(baseline)

# Later — verify integrity before gating
assert verify_baseline_checksum(baseline, checksum), "Baseline tampered!"
```

---

## CLI

```bash
evalgate init                          # Scaffold eval config
evalgate discover                      # Find eval spec files
evalgate discover --manifest           # Generate stable manifest
evalgate run --dir ./evals             # Run all evaluations
evalgate run --write-results           # Run with artifact retention
evalgate gate --baseline b.json        # Regression gate
evalgate ci                            # Run + gate (CI mode)
evalgate ci --base main --format github # CI with PR summary
evalgate compare --base a.json --head b.json  # Side-by-side diff
evalgate doctor                        # Preflight checklist
evalgate explain                       # Root cause analysis on last failure
evalgate impact-analysis --base main   # Run only impacted specs
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Pass — no regression |
| 1 | Regression detected |
| 2 | Infra error (baseline missing, tests crashed) |

---

## Data Export & Import

```python
from evalgate_sdk import export_data, import_data, ExportOptions, export_to_file

# Export
data = await export_data(client, ExportOptions(format="json"))
export_to_file(data, "backup.json")

# Import (2-arg API — client is optional keyword arg)
from evalgate_sdk import import_from_file
data = import_from_file("backup.json")
result = await import_data(data, client=client)

# LangSmith migration
from evalgate_sdk import import_from_langsmith
data = import_from_langsmith(langsmith_export)
```

---

## Reliability

| Feature | Detail |
|---|---|
| **Python** | 3.9, 3.10, 3.11, 3.12, 3.13 |
| **Dependencies** | Only `httpx` + `pydantic` |
| **Async** | Native `async/await` throughout; sync wrappers available |
| **Type hints** | Full `py.typed` — works with mypy and Pyright |
| **Errors** | Structured: `RateLimitError`, `AuthenticationError`, `NetworkError`, `ValidationError` — all have `.message` |
| **Rate handling** | Built-in `RateLimiter` with configurable tiers |
| **Batching** | `batch_process()` with concurrency control |
| **Pagination** | Async `PaginatedIterator` with cursor support |
| **Timeouts** | 30s default on all HTTP clients and LLM assertion calls |
| **Offline** | `WorkflowTracer(offline=True)`, `LocalStorage` for file-based dev |

---

## API Reference

| Module | Methods |
|---|---|
| `client.traces` | `create`, `list`, `get`, `update`, `delete`, `create_span`, `list_spans` |
| `client.evaluations` | `create`, `get`, `list`, `update`, `delete`, `create_test_case`, `list_test_cases`, `create_run`, `list_runs`, `get_run` |
| `client.llm_judge` | `evaluate`, `create_config`, `list_configs`, `list_results`, `get_alignment` |
| `client.annotations` | `create`, `list`, `tasks.create`, `tasks.list`, `tasks.get`, `tasks.items.create`, `tasks.items.list` |
| `client.developer` | `get_usage`, `get_usage_summary`, `api_keys.*`, `webhooks.*` |

---

## v2.3.0 Changelog

**Correctness fixes (parity with TypeScript SDK):**

- **Assertion return types** — `contains_keywords`, `has_sentiment`, `has_readability_score`, `similar_to`, `contains_json`, `has_no_toxicity` now return `AssertionResult` instead of `bool`
- **Toxicity blocklist** — expanded from 9 → 95 terms across 8 categories; uses `\b` word-boundary regex (no substring false positives)
- **`has_valid_code_syntax`** — Python uses `ast.parse` (real syntax validation); other languages use structural regex
- **`has_factual_accuracy`** — entity-aware word-overlap check instead of raw substring matching
- **`has_sentiment_with_score`** — confidence gradient scales with margin × magnitude; single-word inputs no longer return 1.0
- **`WorkflowTracer`** — accepts `name` and `offline` kwargs; offline mode skips all API calls
- **`import_data`** — 2-arg `(data, options)` signature matching TypeScript; client is keyword-only
- **`Logger.child`** — uses `:` separator matching TypeScript (was `.`)
- **`define_eval.skip` / `.only`** — attached as methods on `define_eval`
- **`ValidationError.message`** — `.message` property on all error classes
- **`AssertionLLMConfig.timeout_ms`** — 30s default, enforced via `asyncio.wait_for`
- **`compute_baseline_checksum` / `verify_baseline_checksum`** — SHA-256 tamper detection
- **`TestSuiteConfig`** — added `retries`, `retry_delay_ms`, `retry_jitter`, `seed`, `strict`, `stop_on_failure`
- **`to_have_no_profanity`** — new method on `Expectation` matching TypeScript `toHaveNoProfanity`
- **`RequestCache`** — removed from public exports (internal only)

**Production hardening:**

- 30s default timeout on all `httpx.AsyncClient` calls
- API key validation before sending requests
- URL-encoded query params in `fetch_quality_latest`
- Graceful error handling in `report_trace` and OTel exporter (no more crashes on network errors)
- `run_report` correctly sets `success=False` on test failures
- GitHub Actions formatter uses `GITHUB_OUTPUT` (deprecated `::set-output` removed)
- Config parse errors logged as warnings instead of silently swallowed
- `save_trace` / `save_evaluation` no longer mutate caller's dict
- Subprocess timeout handling in regression gate

**507 tests passing.**

---

## Examples

See [`examples/python/`](https://github.com/pauly7610/ai-evaluation-platform/tree/main/examples/python):

- **[OpenAI Eval](examples/python/openai_eval.ipynb)** — Trace and evaluate OpenAI chat completions
- **[RAG Eval](examples/python/rag_eval.ipynb)** — Evaluate retrieval-augmented generation pipelines
- **[Agent Eval](examples/python/agent_eval.ipynb)** — Test and trace multi-agent workflows

---

## No Lock-in

```bash
rm .evalgate/config.json
```

Your local assertions keep working. No account cancellation. No data export required.

---

## Links

[Platform](https://evalgate.com) · [GitHub](https://github.com/pauly7610/ai-evaluation-platform) · [TypeScript SDK](https://www.npmjs.com/package/@evalgate/sdk)

## License

MIT
