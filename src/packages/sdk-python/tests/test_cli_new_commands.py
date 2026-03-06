"""Tests for new CLI commands (T5): start, watch, compare, validate, promote, replay."""

from __future__ import annotations

import json
from pathlib import Path

from typer.testing import CliRunner

from evalgate_sdk.cli import get_app
from evalgate_sdk.cli.new_commands import (
    TEMPLATE_DESCRIPTIONS,
    TEMPLATES,
    _install_template,
)
from evalgate_sdk.cli.profiles import PROFILES

app = get_app()
runner = CliRunner()


# ── Templates & profiles ─────────────────────────────────────────────


class TestTemplates:
    def test_all_templates_defined(self) -> None:
        assert set(TEMPLATES.keys()) == set(TEMPLATE_DESCRIPTIONS.keys())

    def test_install_template(self, tmp_path) -> None:
        count = _install_template("chatbot", str(tmp_path))
        assert count == 1
        assert (tmp_path / "eval" / "chatbot_quality.py").exists()

    def test_install_template_idempotent(self, tmp_path) -> None:
        _install_template("chatbot", str(tmp_path))
        count2 = _install_template("chatbot", str(tmp_path))
        assert count2 == 0  # already exists

    def test_all_templates_have_files(self) -> None:
        for name, files in TEMPLATES.items():
            assert len(files) > 0, f"Template {name} has no files"


class TestProfiles:
    def test_profile_keys(self) -> None:
        assert set(PROFILES.keys()) == {"strict", "balanced", "fast"}

    def test_strict_is_strictest(self) -> None:
        assert PROFILES["strict"]["min_score"] >= PROFILES["balanced"]["min_score"]
        assert PROFILES["balanced"]["min_score"] >= PROFILES["fast"]["min_score"]


# ── start command ─────────────────────────────────────────────────────


class TestStartCommand:
    def test_start_creates_config(self, tmp_path, monkeypatch) -> None:
        monkeypatch.chdir(tmp_path)
        monkeypatch.delenv("EVALGATE_RUNTIME", raising=False)
        result = runner.invoke(app, ["start"])
        assert result.exit_code == 0
        assert (tmp_path / ".evalgate" / "config.json").exists()

    def test_start_with_template(self, tmp_path, monkeypatch) -> None:
        monkeypatch.chdir(tmp_path)
        monkeypatch.delenv("EVALGATE_RUNTIME", raising=False)
        result = runner.invoke(app, ["start", "--template", "chatbot"])
        assert result.exit_code == 0
        assert (tmp_path / "eval" / "chatbot_quality.py").exists()

    def test_start_invalid_template(self, tmp_path, monkeypatch) -> None:
        monkeypatch.chdir(tmp_path)
        result = runner.invoke(app, ["start", "--template", "nonexistent"])
        assert result.exit_code == 1


# ── compare command ───────────────────────────────────────────────────


class TestCompareCommand:
    def _make_result_file(self, path: Path, total: int = 10, passed: int = 8) -> None:
        data = {
            "summary": {
                "total": total,
                "passed": passed,
                "failed": total - passed,
                "pass_rate": passed / total * 100,
                "average_score": 85.0,
                "total_duration_ms": 1000,
            },
            "results": [],
        }
        path.write_text(json.dumps(data), encoding="utf-8")

    def test_compare_two_files(self, tmp_path) -> None:
        f1 = tmp_path / "run1.json"
        f2 = tmp_path / "run2.json"
        self._make_result_file(f1, total=10, passed=8)
        self._make_result_file(f2, total=10, passed=9)
        result = runner.invoke(app, ["compare", str(f1), str(f2)])
        assert result.exit_code == 0

    def test_compare_json_format(self, tmp_path) -> None:
        f1 = tmp_path / "a.json"
        f2 = tmp_path / "b.json"
        self._make_result_file(f1)
        self._make_result_file(f2)
        result = runner.invoke(app, ["compare", str(f1), str(f2), "--format", "json"])
        assert result.exit_code == 0

    def test_compare_missing_file(self, tmp_path) -> None:
        f1 = tmp_path / "exists.json"
        self._make_result_file(f1)
        result = runner.invoke(app, ["compare", str(f1), str(tmp_path / "missing.json")])
        assert result.exit_code == 1


# ── validate command ──────────────────────────────────────────────────


class TestValidateCommand:
    def test_validate_empty_dir(self, tmp_path, monkeypatch) -> None:
        monkeypatch.chdir(tmp_path)
        eval_dir = tmp_path / "eval"
        eval_dir.mkdir()
        result = runner.invoke(app, ["validate", "--eval-dir", "eval"])
        assert result.exit_code == 0
        assert "0 spec(s)" in result.output

    def test_validate_missing_dir(self, tmp_path, monkeypatch) -> None:
        monkeypatch.chdir(tmp_path)
        result = runner.invoke(app, ["validate", "--eval-dir", "nonexistent"])
        assert result.exit_code == 1


# ── promote command ───────────────────────────────────────────────────


class TestPromoteCommand:
    def test_promote_candidates(self, tmp_path) -> None:
        candidate = tmp_path / "candidates.json"
        candidate.write_text(
            json.dumps(
                {
                    "results": [
                        {"test_name": "test-a", "score": 95},
                        {"test_name": "test-b", "score": 50},
                    ]
                }
            )
        )
        baseline_path = tmp_path / "baseline.json"
        result = runner.invoke(app, ["promote", str(candidate), "--baseline", str(baseline_path), "--min-score", "90"])
        assert result.exit_code == 0
        assert "Promoted 1" in result.output
        assert "Skipped 1" in result.output

        baseline = json.loads(baseline_path.read_text())
        assert "test-a" in baseline["scores"]
        assert "test-b" not in baseline["scores"]

    def test_promote_missing_file(self) -> None:
        result = runner.invoke(app, ["promote", "/nonexistent/file.json"])
        assert result.exit_code == 1


# ── replay command ────────────────────────────────────────────────────


class TestReplayCommand:
    def test_replay_all(self, tmp_path) -> None:
        results = tmp_path / "results.json"
        results.write_text(
            json.dumps(
                {
                    "results": [
                        {"test_name": "a", "score": 100, "passed": True, "duration_ms": 50},
                        {"test_name": "b", "score": 40, "passed": False, "duration_ms": 200},
                    ]
                }
            )
        )
        result = runner.invoke(app, ["replay", str(results)])
        assert result.exit_code == 0
        assert "2 result(s)" in result.output

    def test_replay_specific_spec(self, tmp_path) -> None:
        results = tmp_path / "results.json"
        results.write_text(
            json.dumps(
                {
                    "results": [
                        {"test_name": "a", "score": 100, "passed": True, "duration_ms": 50},
                        {"test_name": "b", "score": 40, "passed": False, "duration_ms": 200},
                    ]
                }
            )
        )
        result = runner.invoke(app, ["replay", str(results), "--spec", "a"])
        assert result.exit_code == 0
        assert "1 result(s)" in result.output

    def test_replay_missing_spec(self, tmp_path) -> None:
        results = tmp_path / "results.json"
        results.write_text(json.dumps({"results": [{"test_name": "a", "score": 100, "passed": True}]}))
        result = runner.invoke(app, ["replay", str(results), "--spec", "nonexistent"])
        assert result.exit_code == 1

    def test_replay_missing_file(self) -> None:
        result = runner.invoke(app, ["replay", "/nonexistent/results.json"])
        assert result.exit_code == 1
