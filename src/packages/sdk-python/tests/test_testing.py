"""Tests for the TestSuite builder."""

import pytest

from evalgate_sdk.testing import create_test_suite
from evalgate_sdk.types import TestSuiteCase, TestSuiteConfig


def _echo(input: str) -> str:
    return f"Echo: {input}"


class TestTestSuite:
    @pytest.mark.asyncio
    async def test_basic_run(self):
        suite = create_test_suite(
            "echo-test",
            TestSuiteConfig(
                evaluator=_echo,
                test_cases=[
                    TestSuiteCase(name="hello", input="hello", expected_output="Echo: hello"),
                ],
            ),
        )
        result = await suite.run()
        assert result.passed
        assert result.total == 1
        assert result.passed_count == 1

    @pytest.mark.asyncio
    async def test_failing_assertion(self):
        suite = create_test_suite(
            "fail-test",
            TestSuiteConfig(
                evaluator=_echo,
                test_cases=[
                    TestSuiteCase(name="wrong", input="hi", expected_output="wrong answer"),
                ],
            ),
        )
        result = await suite.run()
        assert not result.passed
        assert result.failed_count == 1

    @pytest.mark.asyncio
    async def test_custom_assertions(self):
        suite = create_test_suite(
            "custom",
            TestSuiteConfig(
                evaluator=_echo,
                test_cases=[
                    TestSuiteCase(
                        name="contains",
                        input="test",
                        assertions=[{"type": "contains", "value": "Echo"}],
                    ),
                ],
            ),
        )
        result = await suite.run()
        assert result.passed

    @pytest.mark.asyncio
    async def test_add_case(self):
        suite = create_test_suite("add", TestSuiteConfig(evaluator=_echo, test_cases=[]))
        suite.add_case(TestSuiteCase(name="added", input="x", expected_output="Echo: x"))
        result = await suite.run()
        assert result.total == 1
        assert result.passed

    @pytest.mark.asyncio
    async def test_evaluator_error(self):
        def bad_eval(input: str) -> str:
            raise RuntimeError("boom")

        suite = create_test_suite(
            "error",
            TestSuiteConfig(
                evaluator=bad_eval,
                test_cases=[TestSuiteCase(name="boom", input="x")],
            ),
        )
        result = await suite.run()
        assert not result.passed
        assert result.results[0].error == "boom"

    def test_no_evaluator_raises(self):
        suite = create_test_suite(
            "no-eval",
            TestSuiteConfig(test_cases=[TestSuiteCase(name="x", input="x")]),
        )
        with pytest.raises(ValueError, match="No evaluator"):
            import asyncio

            asyncio.get_event_loop().run_until_complete(suite.run())

    def test_to_dict(self):
        suite = create_test_suite("ser", TestSuiteConfig(evaluator=_echo, test_cases=[]))
        d = suite.to_dict()
        assert d["name"] == "ser"
