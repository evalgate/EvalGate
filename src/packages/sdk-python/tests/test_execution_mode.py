"""Tests for execution mode detection (T8)."""

from __future__ import annotations

import pytest

from evalgate_sdk.runtime.execution_mode import (
    ExecutionModeConfig,
    can_run_legacy_mode,
    can_run_spec_mode,
    clear_execution_mode_env,
    find_legacy_config,
    find_spec_files,
    get_execution_mode,
    has_execution_mode_env,
    set_execution_mode_env,
    validate_execution_mode,
)


@pytest.fixture
def project_dir(tmp_path):
    return tmp_path


class TestFindSpecFiles:
    def test_finds_spec_with_define_eval(self, project_dir) -> None:
        eval_dir = project_dir / "eval"
        eval_dir.mkdir()
        spec_file = eval_dir / "test_chat.py"
        spec_file.write_text("from evalgate_sdk import define_eval\ndefine_eval('test', exec)")
        found = find_spec_files(str(project_dir))
        assert len(found) == 1
        assert "test_chat.py" in found[0]

    def test_ignores_files_without_define_eval(self, project_dir) -> None:
        eval_dir = project_dir / "eval"
        eval_dir.mkdir()
        (eval_dir / "helper.py").write_text("def helper(): pass")
        found = find_spec_files(str(project_dir))
        assert len(found) == 0

    def test_ignores_underscore_files(self, project_dir) -> None:
        eval_dir = project_dir / "eval"
        eval_dir.mkdir()
        (eval_dir / "__init__.py").write_text("from evalgate_sdk import define_eval")
        found = find_spec_files(str(project_dir))
        assert len(found) == 0


class TestFindLegacyConfig:
    def test_finds_evalai_config(self, project_dir) -> None:
        (project_dir / "evalai.config.json").write_text("{}")
        result = find_legacy_config(str(project_dir))
        assert result is not None
        assert "evalai.config.json" in result

    def test_finds_evalgate_dir_config(self, project_dir) -> None:
        d = project_dir / ".evalgate"
        d.mkdir()
        (d / "config.json").write_text("{}")
        result = find_legacy_config(str(project_dir))
        assert result is not None

    def test_returns_none_when_no_config(self, project_dir) -> None:
        assert find_legacy_config(str(project_dir)) is None


class TestGetExecutionMode:
    def test_auto_detect_spec(self, project_dir) -> None:
        eval_dir = project_dir / "eval"
        eval_dir.mkdir()
        (eval_dir / "test.py").write_text("define_eval('x', fn)")
        clear_execution_mode_env()
        config = get_execution_mode(str(project_dir))
        assert config.mode == "spec"
        assert config.has_spec_runtime is True

    def test_auto_detect_legacy(self, project_dir) -> None:
        (project_dir / "evalai.config.json").write_text("{}")
        clear_execution_mode_env()
        config = get_execution_mode(str(project_dir))
        assert config.mode == "legacy"
        assert config.has_legacy_runtime is True

    def test_auto_detect_empty(self, project_dir) -> None:
        clear_execution_mode_env()
        config = get_execution_mode(str(project_dir))
        assert config.mode == "auto"

    def test_env_override(self, project_dir, monkeypatch) -> None:
        monkeypatch.setenv("EVALGATE_RUNTIME", "legacy")
        config = get_execution_mode(str(project_dir))
        assert config.mode == "legacy"
        monkeypatch.delenv("EVALGATE_RUNTIME", raising=False)


class TestCanRunModes:
    def test_can_run_spec(self) -> None:
        config = ExecutionModeConfig(has_spec_runtime=True, spec_files=["a.py"])
        assert can_run_spec_mode(config) is True

    def test_cannot_run_spec_no_files(self) -> None:
        config = ExecutionModeConfig(has_spec_runtime=True, spec_files=[])
        assert can_run_spec_mode(config) is False

    def test_can_run_legacy(self) -> None:
        config = ExecutionModeConfig(has_legacy_runtime=True, legacy_config="config.json")
        assert can_run_legacy_mode(config) is True

    def test_cannot_run_legacy_no_config(self) -> None:
        config = ExecutionModeConfig(has_legacy_runtime=True, legacy_config=None)
        assert can_run_legacy_mode(config) is False


class TestValidateExecutionMode:
    def test_valid_spec(self) -> None:
        config = ExecutionModeConfig(mode="spec", has_spec_runtime=True, spec_files=["a.py"])
        result = validate_execution_mode(config)
        assert result["valid"] is True

    def test_spec_no_files_error(self) -> None:
        config = ExecutionModeConfig(mode="spec", has_spec_runtime=False, spec_files=[])
        result = validate_execution_mode(config)
        assert result["valid"] is False
        assert len(result["errors"]) > 0

    def test_mixed_project_warning(self) -> None:
        config = ExecutionModeConfig(
            has_spec_runtime=True, has_legacy_runtime=True,
            spec_files=["a.py"], legacy_config="c.json",
        )
        result = validate_execution_mode(config)
        assert len(result["warnings"]) > 0


class TestEnvHelpers:
    def test_set_and_has(self, monkeypatch) -> None:
        monkeypatch.delenv("EVALGATE_RUNTIME", raising=False)
        assert has_execution_mode_env() is False
        set_execution_mode_env("spec")
        assert has_execution_mode_env() is True
        clear_execution_mode_env()
        assert has_execution_mode_env() is False
