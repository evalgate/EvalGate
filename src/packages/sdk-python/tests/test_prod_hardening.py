"""Regression tests for production hardening fixes.

Each test targets a specific bug found during the prod-readiness audit.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest

# ── R6: _dict_to_config preserves 0 and False ────────────────────────


class TestDictToConfigFalsyValues:
    """_dict_to_config previously used `or` which dropped 0 and False."""

    def test_min_score_zero_preserved(self) -> None:
        from evalgate_sdk.cli.config import _dict_to_config

        cfg = _dict_to_config({"minScore": 0})
        assert cfg.min_score == 0

    def test_max_drop_zero_preserved(self) -> None:
        from evalgate_sdk.cli.config import _dict_to_config

        cfg = _dict_to_config({"maxDrop": 0})
        assert cfg.max_drop == 0

    def test_warn_drop_zero_preserved(self) -> None:
        from evalgate_sdk.cli.config import _dict_to_config

        cfg = _dict_to_config({"warnDrop": 0})
        assert cfg.warn_drop == 0

    def test_min_n_zero_preserved(self) -> None:
        from evalgate_sdk.cli.config import _dict_to_config

        cfg = _dict_to_config({"minN": 0})
        assert cfg.min_n == 0

    def test_allow_weak_evidence_false_preserved(self) -> None:
        from evalgate_sdk.cli.config import _dict_to_config

        cfg = _dict_to_config({"allowWeakEvidence": False})
        assert cfg.allow_weak_evidence is False

    def test_camel_falls_through_to_snake(self) -> None:
        from evalgate_sdk.cli.config import _dict_to_config

        cfg = _dict_to_config({"min_score": 42})
        assert cfg.min_score == 42

    def test_camel_takes_precedence_over_snake(self) -> None:
        from evalgate_sdk.cli.config import _dict_to_config

        cfg = _dict_to_config({"minScore": 10, "min_score": 99})
        assert cfg.min_score == 10


# ── R7: _create_executor_from_test no longer always True ─────────────


class TestExecutorFromTest:
    """Executor was comparing test.expected with itself (always True)."""

    def test_executor_fails_when_input_differs_from_expected(self) -> None:
        from evalgate_sdk.runtime.adapters.testsuite_to_dsl import (
            TestDefinition,
            _create_executor_from_test,
        )

        test = TestDefinition(id="t1", input="hello", expected="world")
        executor = _create_executor_from_test(test, generate_helpers=True)

        class FakeCtx:
            input = "hello"

        result = asyncio.get_event_loop().run_until_complete(executor(FakeCtx()))
        assert result.passed is False
        assert result.score == 0

    def test_executor_passes_when_input_equals_expected(self) -> None:
        from evalgate_sdk.runtime.adapters.testsuite_to_dsl import (
            TestDefinition,
            _create_executor_from_test,
        )

        test = TestDefinition(id="t2", input="match", expected="match")
        executor = _create_executor_from_test(test, generate_helpers=True)

        class FakeCtx:
            input = "match"

        result = asyncio.get_event_loop().run_until_complete(executor(FakeCtx()))
        assert result.passed is True
        assert result.score == 100


# ── R9: parse_run_report survives extra JSON keys ────────────────────


class TestParseRunReportExtraKeys:
    """parse_run_report used to crash on unexpected keys."""

    def test_extra_keys_ignored(self) -> None:
        from evalgate_sdk.runtime.run_report import parse_run_report

        report_data = {
            "schema_version": "1",
            "run_id": "run-extra",
            "started_at": "",
            "finished_at": "",
            "runtime": {},
            "results": [
                {
                    "test_id": "t1",
                    "test_name": "test",
                    "file_path": "f.py",
                    "position": {"line": 1, "column": 1},
                    "input": "x",
                    "passed": True,
                    "score": 100.0,
                    "duration_ms": 10.0,
                    "some_future_field": "ignored",
                }
            ],
            "failures": [],
            "summary": {"total": 1, "passed": 1, "future_metric": 99},
            "config": {"executor_type": "local", "new_config_key": True},
        }
        report = parse_run_report(json.dumps(report_data))
        assert report.run_id == "run-extra"
        assert len(report.results) == 1
        assert report.summary.total == 1


# ── R10: RunReportBuilder.success False on failures ──────────────────


class TestRunReportSuccessOnFailure:
    """summary.success was not set to False on regular test failures."""

    def test_failure_sets_success_false(self) -> None:
        from evalgate_sdk.runtime.run_report import create_run_report

        builder = create_run_report("run-x", {"sdk": "test"})
        builder.add_result(
            test_id="t1", test_name="test", file_path="f.py",
            position={"line": 1, "column": 1}, input="x",
            passed=False, score=10.0,
        )
        report = builder.build()
        assert report.summary.success is False

    def test_all_passing_keeps_success_true(self) -> None:
        from evalgate_sdk.runtime.run_report import create_run_report

        builder = create_run_report("run-y", {"sdk": "test"})
        builder.add_result(
            test_id="t1", test_name="test", file_path="f.py",
            position={"line": 1, "column": 1}, input="x",
            passed=True, score=100.0,
        )
        report = builder.build()
        assert report.summary.success is True


# ── R12: Empty API key raises ValueError ─────────────────────────────


class TestApiKeyValidation:
    """Empty API key previously sent 'Bearer ' header silently."""

    def test_empty_key_raises(self) -> None:
        from evalgate_sdk.cli.api import _require_api_key

        with pytest.raises(ValueError, match="API key is required"):
            _require_api_key("")

    def test_whitespace_key_raises(self) -> None:
        from evalgate_sdk.cli.api import _require_api_key

        with pytest.raises(ValueError, match="API key is required"):
            _require_api_key("   ")

    def test_valid_key_returned_stripped(self) -> None:
        from evalgate_sdk.cli.api import _require_api_key

        assert _require_api_key("  sk-123  ") == "sk-123"


# ── R14: collector.report_trace error handling ───────────────────────


class TestCollectorErrorHandling:
    """report_trace previously let HTTP errors propagate unhandled."""

    def test_http_error_returns_failed_result(self) -> None:
        from evalgate_sdk.collector import (
            ReportTraceInput,
            report_trace,
        )

        mock_client = AsyncMock()
        mock_client._request = AsyncMock(side_effect=RuntimeError("Connection refused"))

        inp = ReportTraceInput(trace_id="t-err", name="test", spans=[])
        result = asyncio.get_event_loop().run_until_complete(report_trace(mock_client, inp))
        assert result.sent is False
        assert "request_failed" in (result.skip_reason or "")


# ── R17: local.save_trace no longer mutates caller dict ──────────────


class TestLocalStorageNoMutation:
    """save_trace/save_evaluation previously mutated the caller's dict."""

    def test_save_trace_does_not_mutate(self, tmp_path: Path) -> None:
        from evalgate_sdk.local import LocalStorage

        storage = LocalStorage(str(tmp_path / "data"))
        data: dict[str, Any] = {"name": "test"}
        storage.save_trace("t1", data)
        assert "saved_at" not in data

    def test_save_evaluation_does_not_mutate(self, tmp_path: Path) -> None:
        from evalgate_sdk.local import LocalStorage

        storage = LocalStorage(str(tmp_path / "data"))
        data: dict[str, Any] = {"name": "test"}
        storage.save_evaluation("e1", data)
        assert "saved_at" not in data


# ── R17: config.load_config warns on parse failure ───────────────────


class TestConfigWarnsOnParseError:
    """load_config previously swallowed all exceptions silently."""

    def test_invalid_json_emits_warning(self, tmp_path: Path) -> None:
        from evalgate_sdk.cli.config import load_config

        config_file = tmp_path / "evalgate.config.json"
        config_file.write_text("{invalid json", encoding="utf-8")

        with pytest.warns(match="Failed to load config"):
            result = load_config(str(tmp_path))
        assert result is None
