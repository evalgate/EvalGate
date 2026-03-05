"""Tests for RunReport deterministic serialization (T4)."""

from __future__ import annotations

import json

import pytest

from evalgate_sdk.runtime.run_report import (
    RUN_REPORT_SCHEMA_VERSION,
    RunReport,
    create_run_report,
    parse_run_report,
)

RUNTIME_INFO = {"id": "rt-1", "namespace": "test-project", "project_root": "/tmp/project"}


class TestRunReportBuilder:
    def test_empty_report(self) -> None:
        builder = create_run_report("run-1", RUNTIME_INFO)
        report = builder.build()
        assert report.run_id == "run-1"
        assert report.schema_version == RUN_REPORT_SCHEMA_VERSION
        assert report.summary.total == 0
        assert report.summary.success is True
        assert report.finished_at != ""

    def test_add_passing_result(self) -> None:
        builder = create_run_report("run-2", RUNTIME_INFO)
        builder.add_result(
            test_id="t-1",
            test_name="test-a",
            file_path="eval/test.py",
            position={"line": 10, "column": 1},
            input="hello",
            passed=True,
            score=95.0,
            duration_ms=100.0,
            tags=["smoke"],
        )
        report = builder.build()
        assert report.summary.total == 1
        assert report.summary.passed == 1
        assert report.summary.pass_rate == 100.0
        assert report.summary.average_score == 95.0
        assert len(report.results) == 1
        assert report.results[0].test_name == "test-a"
        assert len(report.failures) == 0

    def test_add_failing_result(self) -> None:
        builder = create_run_report("run-3", RUNTIME_INFO)
        builder.add_result(
            test_id="t-1",
            test_name="test-fail",
            file_path="eval/test.py",
            position={"line": 1, "column": 1},
            input="x",
            passed=False,
            score=30.0,
            error="assertion failed",
        )
        report = builder.build()
        assert report.summary.failed == 1
        assert report.summary.success is False  # failures must set success=False
        assert len(report.failures) == 1
        assert report.failures[0].classification == "failed"
        assert report.failures[0].message == "assertion failed"

    def test_add_error_result(self) -> None:
        builder = create_run_report("run-4", RUNTIME_INFO)
        builder.add_result(
            test_id="t-1",
            test_name="test-err",
            file_path="eval/test.py",
            position={"line": 1, "column": 1},
            input="x",
            passed=False,
            score=0.0,
            classification="error",
            error="RuntimeError: boom",
        )
        report = builder.build()
        assert report.summary.errors == 1
        assert report.summary.success is False

    def test_deterministic_sort(self) -> None:
        builder = create_run_report("run-5", RUNTIME_INFO)
        for tid in ["c", "a", "b"]:
            builder.add_result(
                test_id=tid,
                test_name=f"test-{tid}",
                file_path="eval/test.py",
                position={"line": 1, "column": 1},
                input="x",
                passed=True,
                score=100.0,
            )
        report = builder.build()
        assert [r.test_id for r in report.results] == ["a", "b", "c"]

    def test_set_config(self) -> None:
        builder = create_run_report("run-6", RUNTIME_INFO)
        builder.set_config(executor_type="cloud", max_parallel=4)
        report = builder.build()
        assert report.config.executor_type == "cloud"
        assert report.config.max_parallel == 4

    def test_to_json_roundtrip(self) -> None:
        builder = create_run_report("run-7", RUNTIME_INFO)
        builder.add_result(
            test_id="t-1",
            test_name="roundtrip",
            file_path="eval/test.py",
            position={"line": 1, "column": 1},
            input="hello",
            passed=True,
            score=88.0,
            duration_ms=50.0,
        )
        json_str = builder.to_json()
        parsed = json.loads(json_str)
        assert parsed["run_id"] == "run-7"
        assert parsed["schema_version"] == RUN_REPORT_SCHEMA_VERSION
        assert len(parsed["results"]) == 1

    def test_multiple_results_summary(self) -> None:
        builder = create_run_report("run-8", RUNTIME_INFO)
        builder.add_result(
            test_id="t-1", test_name="a", file_path="f", position={"line": 1, "column": 1},
            input="x", passed=True, score=80.0, duration_ms=100.0,
        )
        builder.add_result(
            test_id="t-2", test_name="b", file_path="f", position={"line": 2, "column": 1},
            input="y", passed=False, score=40.0, duration_ms=200.0,
        )
        report = builder.build()
        assert report.summary.total == 2
        assert report.summary.passed == 1
        assert report.summary.failed == 1
        assert report.summary.pass_rate == 50.0
        assert report.summary.total_duration_ms == 300.0
        assert report.summary.average_score == 60.0  # (80 + 40) / 2


class TestParseRunReport:
    def test_parse_valid(self) -> None:
        builder = create_run_report("run-p1", RUNTIME_INFO)
        builder.add_result(
            test_id="t-1", test_name="test", file_path="f.py",
            position={"line": 1, "column": 1}, input="x",
            passed=True, score=100.0,
        )
        json_str = builder.to_json()
        report = parse_run_report(json_str)
        assert isinstance(report, RunReport)
        assert report.run_id == "run-p1"
        assert len(report.results) == 1

    def test_parse_invalid_version(self) -> None:
        data = {"schema_version": "99", "run_id": "bad"}
        with pytest.raises(ValueError, match="Unsupported"):
            parse_run_report(json.dumps(data))
