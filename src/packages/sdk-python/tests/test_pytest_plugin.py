"""Tests for pytest matcher plugin (T9)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from evalgate_sdk.pytest_plugin import (
    assert_all_assertions_passed,
    assert_no_errors,
    assert_passes_gate,
    assert_score_above,
    assert_score_between,
)


@dataclass
class FakeResult:
    passed: bool = True
    score: float = 95.0
    error: str | None = None
    status: str = "passed"
    assertions: list[Any] | None = None


class TestAssertPassesGate:
    def test_passing(self) -> None:
        assert_passes_gate(FakeResult(passed=True))

    def test_failing(self) -> None:
        with pytest.raises(pytest.fail.Exception, match="gate failed"):
            assert_passes_gate(FakeResult(passed=False, score=40.0, error="too low"))

    def test_dict_input(self) -> None:
        assert_passes_gate({"passed": True, "score": 100})

    def test_dict_failing(self) -> None:
        with pytest.raises(pytest.fail.Exception):
            assert_passes_gate({"passed": False, "error": "bad"})


class TestAssertScoreAbove:
    def test_above(self) -> None:
        assert_score_above(FakeResult(score=95.0), 90.0)

    def test_below(self) -> None:
        with pytest.raises(pytest.fail.Exception, match="below threshold"):
            assert_score_above(FakeResult(score=50.0), 90.0)

    def test_no_score(self) -> None:
        with pytest.raises(pytest.fail.Exception, match="no 'score'"):
            assert_score_above({}, 90.0)


class TestAssertScoreBetween:
    def test_in_range(self) -> None:
        assert_score_between(FakeResult(score=85.0), 80.0, 90.0)

    def test_out_of_range(self) -> None:
        with pytest.raises(pytest.fail.Exception, match="not in"):
            assert_score_between(FakeResult(score=95.0), 80.0, 90.0)


class TestAssertNoErrors:
    def test_no_error(self) -> None:
        assert_no_errors(FakeResult())

    def test_has_error(self) -> None:
        with pytest.raises(pytest.fail.Exception, match="has error"):
            assert_no_errors(FakeResult(error="boom"))

    def test_error_status(self) -> None:
        with pytest.raises(pytest.fail.Exception, match="'error'"):
            assert_no_errors(FakeResult(status="error"))


class TestAssertAllAssertionsPassed:
    def test_all_passed(self) -> None:
        result = FakeResult(assertions=[
            {"passed": True, "assertion_type": "a"},
            {"passed": True, "assertion_type": "b"},
        ])
        assert_all_assertions_passed(result)

    def test_one_failed(self) -> None:
        result = FakeResult(assertions=[
            {"passed": True, "assertion_type": "a"},
            {"passed": False, "assertion_type": "check-b", "message": "nope"},
        ])
        with pytest.raises(pytest.fail.Exception, match="check-b"):
            assert_all_assertions_passed(result)

    def test_empty_assertions(self) -> None:
        assert_all_assertions_passed(FakeResult(assertions=[]))
