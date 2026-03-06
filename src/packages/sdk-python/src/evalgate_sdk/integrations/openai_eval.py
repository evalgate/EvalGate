"""openai_chat_eval — local-first regression testing against OpenAI models."""

from __future__ import annotations

import hashlib
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from evalgate_sdk.assertions import expect


@dataclass
class OpenAIChatEvalCase:
    input: str
    expected_output: str | None = None
    test_case_id: str | None = None
    assertions: list[dict[str, Any]] | None = None


@dataclass
class OpenAIChatEvalCaseResult:
    test_case_id: str
    input: str
    output: str
    expected_output: str | None
    passed: bool
    score: float
    assertions: list[dict[str, Any]] = field(default_factory=list)
    duration_ms: float = 0
    retries: int = 0
    error: str | None = None


@dataclass
class OpenAIChatEvalResult:
    passed: bool
    name: str
    total: int
    passed_count: int
    failed_count: int
    score: float
    duration_ms: float
    results: list[OpenAIChatEvalCaseResult] = field(default_factory=list)
    retried_cases: int = 0


def _input_hash(text: str) -> str:
    normalized = " ".join(text.strip().split())
    return hashlib.sha256(normalized.encode()).hexdigest()[:12]


async def openai_chat_eval(
    *,
    name: str = "openai-eval",
    model: str = "gpt-4",
    api_key: str | None = None,
    cases: list[OpenAIChatEvalCase],
    system_prompt: str | None = None,
    retries: int = 0,
    temperature: float = 0.0,
    call_fn: Callable[..., Any] | None = None,
    report_to_evalai: bool = False,
    evalai_client: Any | None = None,
    evaluation_id: int | None = None,
) -> OpenAIChatEvalResult:
    """Run a local regression eval suite against an OpenAI-compatible model.

    Requires either ``call_fn`` (a custom async function) or the ``openai`` package.

    Args:
        name: Suite name for reporting.
        model: Model identifier.
        api_key: OpenAI API key (falls back to OPENAI_API_KEY env var).
        cases: List of test cases.
        system_prompt: Optional system prompt prepended to every call.
        retries: Number of retry attempts per case.
        temperature: Sampling temperature.
        call_fn: Optional custom async function(messages) -> str.
        report_to_evalai: If True, upload results to the EvalAI platform.
        evalai_client: AIEvalClient instance (required if report_to_evalai is True).
        evaluation_id: Evaluation ID to associate with (if reporting).

    Returns:
        OpenAIChatEvalResult with per-case results and aggregate score.
    """
    if call_fn is None:
        call_fn = _make_openai_call(model, api_key, system_prompt, temperature)

    results: list[OpenAIChatEvalCaseResult] = []
    suite_start = time.monotonic()
    retried_total = 0

    for case in cases:
        case_id = case.test_case_id or _input_hash(case.input)
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": case.input})

        output = ""
        error: str | None = None
        case_retries = 0
        case_start = time.monotonic()

        for _attempt in range(1 + retries):
            try:
                output = await call_fn(messages)
                error = None
                break
            except Exception as exc:
                error = str(exc)
                case_retries += 1

        duration = (time.monotonic() - case_start) * 1000

        assertion_results: list[dict[str, Any]] = []
        case_passed = error is None

        if error is None and case.assertions:
            for a_def in case.assertions:
                a_type = a_def.get("type", "")
                a_value = a_def.get("value")
                exp = expect(output)
                if a_type == "contains" and isinstance(a_value, str):
                    r = exp.to_contain(a_value)
                elif a_type == "not_contains" and isinstance(a_value, str):
                    r = exp.to_not_contain(a_value)
                elif a_type == "equals":
                    r = exp.to_equal(a_value)
                elif a_type == "matches_pattern" and isinstance(a_value, str):
                    r = exp.to_match_pattern(a_value)
                else:
                    continue
                assertion_results.append({"type": a_type, "passed": r.passed, "message": r.message})
                if not r.passed:
                    case_passed = False

        if error is None and case.expected_output is not None and not case.assertions:
            r = expect(output).to_equal(case.expected_output)
            assertion_results.append({"type": "equals", "passed": r.passed, "message": r.message})
            if not r.passed:
                case_passed = False

        if case_retries > 0:
            retried_total += 1

        results.append(
            OpenAIChatEvalCaseResult(
                test_case_id=case_id,
                input=case.input,
                output=output,
                expected_output=case.expected_output,
                passed=case_passed,
                score=1.0 if case_passed else 0.0,
                assertions=assertion_results,
                duration_ms=duration,
                retries=case_retries,
                error=error,
            )
        )

    total_duration = (time.monotonic() - suite_start) * 1000
    passed_count = sum(1 for r in results if r.passed)
    score = passed_count / len(results) if results else 0.0

    eval_result = OpenAIChatEvalResult(
        passed=all(r.passed for r in results),
        name=name,
        total=len(results),
        passed_count=passed_count,
        failed_count=len(results) - passed_count,
        score=score,
        duration_ms=total_duration,
        results=results,
        retried_cases=retried_total,
    )

    if report_to_evalai and evalai_client and evaluation_id:
        try:
            from evalgate_sdk.types import CreateRunParams

            await evalai_client.evaluations.create_run(
                evaluation_id,
                CreateRunParams(
                    execution_settings={"score": score, "results_count": len(results)},
                ),
            )
        except Exception:
            pass

    return eval_result


def _make_openai_call(
    model: str,
    api_key: str | None,
    system_prompt: str | None,
    temperature: float,
) -> Callable[..., Any]:
    """Create an async call function using the OpenAI SDK."""

    async def _call(messages: list[dict[str, str]]) -> str:
        try:
            import openai
        except ImportError as exc:
            raise ImportError("Install openai: pip install 'pauly4010-evalgate-sdk[openai]'") from exc

        import os

        key = api_key or os.environ.get("OPENAI_API_KEY", "")
        client = openai.AsyncOpenAI(api_key=key)
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""

    return _call
