"""Tests for output formatters (T10)."""

from __future__ import annotations

import json

from evalgate_sdk.formatters.github import format_github
from evalgate_sdk.formatters.human import format_human
from evalgate_sdk.formatters.json_fmt import format_json
from evalgate_sdk.formatters.pr_comment import format_pr_comment

SAMPLE_REPORT = {
    "verdict": "fail",
    "evaluationId": "eval-123",
    "score": 75,
    "baselineScore": 90,
    "delta": -15,
    "reasonMessage": "Score dropped below threshold",
    "summary": {
        "total": 10,
        "passed": 7,
        "failed": 3,
        "pass_rate": 70.0,
        "average_score": 72.5,
        "total_duration_ms": 5000,
    },
    "failedCases": [
        {"name": "test-a", "reason": "score too low"},
        {"name": "test-b", "reason": "timeout"},
    ],
}

PASSING_REPORT = {
    "verdict": "pass",
    "evaluationId": "eval-456",
    "score": 95,
    "summary": {
        "total": 5, "passed": 5, "failed": 0, 
        "pass_rate": 100.0, "average_score": 95.0, "total_duration_ms": 200
    },
}


class TestHumanFormatter:
    def test_fail_report(self) -> None:
        out = format_human(SAMPLE_REPORT)
        assert "FAIL" in out
        assert "eval-123" in out
        assert "70.0%" in out
        assert "test-a" in out

    def test_pass_report(self) -> None:
        out = format_human(PASSING_REPORT)
        assert "PASS" in out
        assert "eval-456" in out

    def test_baseline_delta(self) -> None:
        out = format_human(SAMPLE_REPORT)
        assert "Baseline" in out
        assert "-15" in out


class TestJsonFormatter:
    def test_roundtrip(self) -> None:
        out = format_json(SAMPLE_REPORT)
        parsed = json.loads(out)
        assert parsed["verdict"] == "fail"
        assert parsed["score"] == 75

    def test_indent(self) -> None:
        out = format_json(SAMPLE_REPORT, indent=4)
        assert "    " in out


class TestGitHubFormatter:
    def test_fail_annotations(self) -> None:
        out = format_github(SAMPLE_REPORT)
        assert "::error title=EvalGate Fail" in out
        assert "eval-123" in out

    def test_pass_annotations(self) -> None:
        out = format_github(PASSING_REPORT)
        assert "::notice title=EvalGate Pass" in out

    def test_failed_case_annotations(self) -> None:
        out = format_github(SAMPLE_REPORT)
        assert "test-a: score too low" in out


class TestPRCommentFormatter:
    def test_fail_markdown(self) -> None:
        out = format_pr_comment(SAMPLE_REPORT)
        assert "## ❌ EvalGate: Fail" in out
        assert "| Total | 10 |" in out
        assert "**test-a**" in out
        assert "eval-123" in out

    def test_pass_markdown(self) -> None:
        out = format_pr_comment(PASSING_REPORT)
        assert "## ✅ EvalGate: Pass" in out

    def test_baseline_display(self) -> None:
        out = format_pr_comment(SAMPLE_REPORT)
        assert "baseline: 90" in out
        assert "-15" in out

    def test_dashboard_link(self) -> None:
        report = {**PASSING_REPORT, "dashboardUrl": "https://app.evalgate.com/run/123"}
        out = format_pr_comment(report)
        assert "[View in dashboard]" in out
