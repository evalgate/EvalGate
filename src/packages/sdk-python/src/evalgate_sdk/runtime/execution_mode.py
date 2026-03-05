"""Dual-path execution mode detection (T8).

Port of the TypeScript SDK's ``execution-mode.ts``.
Environment flag ``EVALGATE_RUNTIME=legacy|spec|auto``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

ExecutionMode = Literal["legacy", "spec", "auto"]

ENV_VAR = "EVALGATE_RUNTIME"
POSSIBLE_VALUES = ("legacy", "spec", "auto")
DEFAULT_MODE: ExecutionMode = "auto"


@dataclass
class ExecutionModeConfig:
    mode: ExecutionMode = "auto"
    has_spec_runtime: bool = False
    has_legacy_runtime: bool = False
    project_root: str = ""
    spec_files: list[str] = field(default_factory=list)
    legacy_config: str | None = None


def find_spec_files(project_root: str) -> list[str]:
    """Search for Python files containing ``define_eval`` calls."""
    root = Path(project_root)
    patterns = [
        "eval/**/*.py",
        "evals/**/*.py",
        "src/**/*.py",
        "tests/**/*.py",
        "spec/**/*.py",
    ]

    found: list[str] = []
    for pattern in patterns:
        for f in root.glob(pattern):
            if f.name.startswith("_"):
                continue
            try:
                content = f.read_text(encoding="utf-8", errors="ignore")
                if "define_eval" in content:
                    found.append(str(f))
            except OSError:
                continue
    return found


def find_legacy_config(project_root: str) -> str | None:
    """Search for legacy config files."""
    root = Path(project_root)
    candidates = [
        "evalai.config.json",
        "evalai.config.py",
        "evalgate.config.json",
        ".evalgaterc",
        ".evalgaterc.json",
        ".evalgate/config.json",
        ".evalai/config.json",
    ]
    for name in candidates:
        p = root / name
        if p.exists():
            return str(p)
    return None


def get_execution_mode(project_root: str | None = None) -> ExecutionModeConfig:
    """Determine execution mode from environment or auto-detection."""
    root = project_root or os.getcwd()
    env_mode = os.environ.get(ENV_VAR, "").lower()

    if env_mode in POSSIBLE_VALUES:
        spec_files = find_spec_files(root) if env_mode != "legacy" else []
        legacy_config = find_legacy_config(root) if env_mode != "spec" else None
        return ExecutionModeConfig(
            mode=env_mode,  # type: ignore[arg-type]
            has_spec_runtime=env_mode != "legacy",
            has_legacy_runtime=env_mode != "spec",
            project_root=root,
            spec_files=spec_files,
            legacy_config=legacy_config,
        )

    # Auto-detect
    spec_files = find_spec_files(root)
    legacy_config = find_legacy_config(root)
    has_spec = len(spec_files) > 0
    has_legacy = legacy_config is not None

    if has_spec:
        mode: ExecutionMode = "spec"
    elif has_legacy:
        mode = "legacy"
    else:
        mode = "auto"

    return ExecutionModeConfig(
        mode=mode,
        has_spec_runtime=has_spec,
        has_legacy_runtime=has_legacy,
        project_root=root,
        spec_files=spec_files,
        legacy_config=legacy_config,
    )


def can_run_spec_mode(config: ExecutionModeConfig) -> bool:
    return config.has_spec_runtime and len(config.spec_files) > 0


def can_run_legacy_mode(config: ExecutionModeConfig) -> bool:
    return config.has_legacy_runtime and config.legacy_config is not None


def get_recommended_mode(config: ExecutionModeConfig) -> ExecutionMode:
    if config.mode != "auto":
        return config.mode
    if can_run_spec_mode(config):
        return "spec"
    if can_run_legacy_mode(config):
        return "legacy"
    return "auto"


def validate_execution_mode(config: ExecutionModeConfig) -> dict[str, list[str] | bool]:
    """Validate execution mode compatibility."""
    warnings: list[str] = []
    errors: list[str] = []

    if config.has_spec_runtime and config.has_legacy_runtime:
        warnings.append(
            "Project contains both spec files and legacy config. "
            "Consider migrating legacy tests to spec format."
        )

    if not config.has_spec_runtime and not config.has_legacy_runtime:
        warnings.append(
            "No tests found. Use 'evalgate init' to create a new project."
        )

    if config.mode == "spec" and not can_run_spec_mode(config):
        errors.append(
            "Spec mode requested but no spec files found. "
            "Create spec files with define_eval() or use legacy mode."
        )

    if config.mode == "legacy" and not can_run_legacy_mode(config):
        errors.append(
            "Legacy mode requested but no config file found. "
            "Create a config file or use spec mode."
        )

    return {"valid": len(errors) == 0, "warnings": warnings, "errors": errors}


def has_execution_mode_env() -> bool:
    return ENV_VAR in os.environ


def get_execution_mode_env() -> str | None:
    return os.environ.get(ENV_VAR)


def set_execution_mode_env(mode: ExecutionMode) -> None:
    os.environ[ENV_VAR] = mode


def clear_execution_mode_env() -> None:
    os.environ.pop(ENV_VAR, None)
