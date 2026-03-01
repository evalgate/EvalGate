"""Test suite builder for running structured evaluations against LLM outputs."""

from __future__ import annotations

import time
from typing import Any

from evalgate_sdk.assertions import AssertionResult, expect
from evalgate_sdk.types import (
    TestSuiteCase,
    TestSuiteCaseResult,
    TestSuiteConfig,
    TestSuiteResult,
)


class TestSuite:
    """A collection of test cases that can be executed against an evaluator function.

    Usage::

        suite = create_test_suite("My Suite", config=TestSuiteConfig(
            test_cases=[
                TestSuiteCase(name="greet", input="Hello", expected_output="Hi"),
            ],
            evaluator=my_llm_call,
        ))
        result = await suite.run()
    """

    def __init__(self, name: str, config: TestSuiteConfig) -> None:
        self._name = name
        self._config = config
        self._cases: list[TestSuiteCase] = list(config.test_cases)

    @property
    def name(self) -> str:
        return self._name

    def add_case(self, case: TestSuiteCase) -> None:
        self._cases.append(case)

    def get_config(self) -> TestSuiteConfig:
        return self._config

    def get_cases(self) -> list[TestSuiteCase]:
        return list(self._cases)

    async def run(self) -> TestSuiteResult:
        evaluator = self._config.evaluator
        if evaluator is None:
            raise ValueError("No evaluator provided in TestSuiteConfig")

        results: list[TestSuiteCaseResult] = []
        suite_start = time.monotonic()

        for case in self._cases:
            case_start = time.monotonic()
            output: str | None = None
            error: str | None = None
            assertions: list[AssertionResult] = []

            try:
                raw = evaluator(case.input)
                output = str(await raw) if hasattr(raw, "__await__") or hasattr(raw, "__anext__") else str(raw)
            except Exception as exc:
                error = str(exc)

            if output is not None and case.assertions:
                for assertion_def in case.assertions:
                    a_type = assertion_def.get("type", "")
                    a_value = assertion_def.get("value")
                    exp = expect(output)
                    if a_type == "contains" and isinstance(a_value, str):
                        assertions.append(exp.to_contain(a_value))
                    elif a_type == "equals" and a_value is not None:
                        assertions.append(exp.to_equal(a_value))
                    elif a_type == "not_contains_pii":
                        assertions.append(exp.to_not_contain_pii())

            if output is not None and case.expected_output is not None and not assertions:
                assertions.append(expect(output).to_equal(case.expected_output))

            case_passed = error is None and all(a.passed for a in assertions)
            duration = int((time.monotonic() - case_start) * 1000)

            results.append(
                TestSuiteCaseResult(
                    name=case.name,
                    passed=case_passed,
                    duration_ms=duration,
                    input=case.input,
                    output=output,
                    expected_output=case.expected_output,
                    assertions=assertions,
                    error=error,
                )
            )

        total_duration = int((time.monotonic() - suite_start) * 1000)
        passed_count = sum(1 for r in results if r.passed)

        return TestSuiteResult(
            suite_name=self._name,
            passed=all(r.passed for r in results),
            total=len(results),
            passed_count=passed_count,
            failed_count=len(results) - passed_count,
            duration_ms=total_duration,
            results=results,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self._name,
            "config": self._config.model_dump(),
            "cases": [c.model_dump() for c in self._cases],
        }


def create_test_suite(name: str, config: TestSuiteConfig) -> TestSuite:
    """Create a new test suite.

    Args:
        name: Human-readable suite name.
        config: Suite configuration including test cases and evaluator.
    """
    return TestSuite(name, config)
