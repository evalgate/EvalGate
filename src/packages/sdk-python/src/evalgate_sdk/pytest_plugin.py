"""Pytest plugin for EvalGate assertions (T9).

Provides custom pytest assertions for eval results and a plugin
that can be auto-registered via pyproject.toml entry points.

Usage::

    from evalgate_sdk.pytest_plugin import assert_passes_gate, assert_score_above

    def test_chatbot_quality(eval_result):
        assert_passes_gate(eval_result)
        assert_score_above(eval_result, 90.0)

Note: pytest is imported lazily so the SDK can be used without pytest installed.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import pytest as _pytest_type  # noqa: F401


def _get_pytest() -> Any:
    """Lazily import pytest, raising a clear error if not installed."""
    try:
        import pytest
        return pytest
    except ImportError as exc:
        raise ImportError(
            "pytest is required for evalgate_sdk.pytest_plugin. "
            "Install with: pip install pytest"
        ) from exc


def assert_passes_gate(result: Any, message: str = "") -> None:
    """Assert that an eval result passes the quality gate.

    *result* should have a ``passed`` attribute (or key) that is truthy.
    """
    pytest = _get_pytest()
    passed = _get_field(result, "passed")
    if not passed:
        error = _get_field(result, "error") or "unknown reason"
        score = _get_field(result, "score")
        msg = message or f"Eval gate failed (score={score}): {error}"
        pytest.fail(msg)


def assert_score_above(result: Any, threshold: float, message: str = "") -> None:
    """Assert that the eval result score is above *threshold*."""
    pytest = _get_pytest()
    score = _get_field(result, "score")
    if score is None:
        pytest.fail(message or "Result has no 'score' field")
    if score < threshold:
        pytest.fail(message or f"Score {score} is below threshold {threshold}")


def assert_score_between(result: Any, min_score: float, max_score: float, message: str = "") -> None:
    """Assert that the eval result score is within [min_score, max_score]."""
    pytest = _get_pytest()
    score = _get_field(result, "score")
    if score is None:
        pytest.fail(message or "Result has no 'score' field")
    if score < min_score or score > max_score:
        pytest.fail(message or f"Score {score} not in [{min_score}, {max_score}]")


def assert_no_errors(result: Any, message: str = "") -> None:
    """Assert that the eval result has no errors."""
    pytest = _get_pytest()
    error = _get_field(result, "error")
    status = _get_field(result, "status")
    if error:
        pytest.fail(message or f"Eval result has error: {error}")
    if status == "error":
        pytest.fail(message or "Eval result status is 'error'")


def assert_all_assertions_passed(result: Any, message: str = "") -> None:
    """Assert that all sub-assertions in the result passed."""
    pytest = _get_pytest()
    assertions = _get_field(result, "assertions") or []
    for i, assertion in enumerate(assertions):
        passed = _get_field(assertion, "passed")
        if not passed:
            name = _get_field(assertion, "assertion_type") or _get_field(assertion, "name") or f"assertion-{i}"
            msg = _get_field(assertion, "message") or "failed"
            pytest.fail(message or f"Sub-assertion '{name}' failed: {msg}")


def _get_field(obj: Any, field: str) -> Any:
    """Get a field from a dict or dataclass/object."""
    if isinstance(obj, dict):
        return obj.get(field)
    return getattr(obj, field, None)
