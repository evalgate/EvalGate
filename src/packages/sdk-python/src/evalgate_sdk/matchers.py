"""Pytest plugin — provides ``to_pass_gate`` assertion for regression results."""

from __future__ import annotations

from typing import Any


def to_pass_gate(result: Any) -> bool:
    """Check if an eval result passes the gate.

    Works with ``OpenAIChatEvalResult`` and any object with a ``passed`` attribute.

    Usage in pytest::

        from evalgate_sdk.matchers import to_pass_gate

        result = await openai_chat_eval(...)
        assert to_pass_gate(result)
    """
    if hasattr(result, "passed"):
        return bool(result.passed)
    if isinstance(result, dict):
        return bool(result.get("passed", False))
    return False


class GateAssertionError(AssertionError):
    """Raised when a gate assertion fails with diagnostic info."""

    def __init__(self, result: Any) -> None:
        self.result = result
        score = getattr(result, "score", "?")
        total = getattr(result, "total", "?")
        passed = getattr(result, "passed_count", "?")
        super().__init__(f"Gate assertion failed: {passed}/{total} passed (score={score})")


def assert_passes_gate(result: Any) -> None:
    """Assert that a result passes the gate, with rich error output."""
    if not to_pass_gate(result):
        raise GateAssertionError(result)


# ── Pytest plugin ────────────────────────────────────────────────────

try:
    import pytest

    @pytest.fixture
    def gate_result():
        """Fixture that provides a gate assertion helper."""
        return assert_passes_gate

except ImportError:
    pass
