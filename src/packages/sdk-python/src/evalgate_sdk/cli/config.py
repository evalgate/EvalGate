"""EvalGate config loader.

Discovery: evalgate.config.json → evalai.config.json → pyproject.toml [evalgate].
Port of ``cli/config.ts``.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from evalgate_sdk.cli.new_commands import PROFILES

ProfileName = Literal["strict", "balanced", "fast"]

CONFIG_FILES = [
    "evalgate.config.json",
    "evalai.config.json",
]


@dataclass
class EvalAIConfig:
    """Loaded configuration."""
    evaluation_id: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    min_score: int | None = None
    min_n: int | None = None
    max_drop: int | None = None
    warn_drop: int | None = None
    allow_weak_evidence: bool | None = None
    baseline: str | None = None  # "published" | "previous" | "production" | "auto"
    profile: str | None = None
    packages: dict[str, Any] | None = None


def find_config_path(cwd: str | None = None) -> str | None:
    """Find config file path in directory, walking up to root."""
    directory = os.path.abspath(cwd or os.getcwd())
    root = os.path.splitdrive(directory)[0] + os.sep

    while True:
        for name in CONFIG_FILES:
            candidate = os.path.join(directory, name)
            if os.path.isfile(candidate):
                return candidate

        # Check pyproject.toml for [tool.evalgate] or [tool.evalai]
        pyproject = os.path.join(directory, "pyproject.toml")
        if os.path.isfile(pyproject):
            try:
                text = Path(pyproject).read_text(encoding="utf-8")
                if "[tool.evalgate]" in text or "[tool.evalai]" in text:
                    return pyproject
            except OSError:
                pass

        parent = os.path.dirname(directory)
        if parent == directory or directory == root:
            break
        directory = parent

    return None


def load_config(cwd: str | None = None) -> EvalAIConfig | None:
    """Load config from file system."""
    config_path = find_config_path(cwd)
    if not config_path:
        return None

    try:
        if config_path.endswith("pyproject.toml"):
            return _load_from_pyproject(config_path, cwd)

        with open(config_path, encoding="utf-8") as f:
            data = json.load(f)

        config = _dict_to_config(data)

        # Monorepo package resolution
        if config.packages and cwd:
            config_dir = os.path.dirname(config_path)
            rel = os.path.relpath(os.path.abspath(cwd), config_dir).replace("\\", "/")
            pkg_config = config.packages.get(rel)
            if pkg_config:
                merged = _dict_to_config({**_config_to_dict(config), **pkg_config})
                merged.packages = config.packages
                return merged
            for key, val in config.packages.items():
                if rel == key or rel.startswith(f"{key}/"):
                    merged = _dict_to_config({**_config_to_dict(config), **val})
                    merged.packages = config.packages
                    return merged

        return config
    except Exception as exc:
        import warnings
        warnings.warn(f"[EvalGate] Failed to load config from {config_path}: {exc}", stacklevel=2)
        return None


def merge_config_with_args(
    config: EvalAIConfig | None,
    args: dict[str, Any],
) -> dict[str, Any]:
    """Merge config with CLI args. Priority: args > profile > config > defaults."""
    merged: dict[str, Any] = {}

    if config:
        if config.evaluation_id:
            merged["evaluation_id"] = config.evaluation_id
        if config.base_url:
            merged["base_url"] = config.base_url
        if config.min_score is not None:
            merged["min_score"] = config.min_score
        if config.min_n is not None:
            merged["min_n"] = config.min_n
        if config.max_drop is not None:
            merged["max_drop"] = config.max_drop
        if config.warn_drop is not None:
            merged["warn_drop"] = config.warn_drop
        if config.allow_weak_evidence is not None:
            merged["allow_weak_evidence"] = config.allow_weak_evidence
        if config.baseline:
            merged["baseline"] = config.baseline
        if config.profile:
            merged["profile"] = config.profile

    # Profile defaults
    profile_name = args.get("profile") or merged.get("profile")
    if profile_name and profile_name in PROFILES:
        profile = PROFILES[profile_name]
        for key in ("min_score", "max_drop", "warn_drop", "min_n", "allow_weak_evidence"):
            if merged.get(key) is None and args.get(key) is None and key in profile:
                merged[key] = profile[key]

    # Args override
    for key in (
        "evaluation_id", "base_url", "min_score", "max_drop", 
        "warn_drop", "min_n", "allow_weak_evidence", "baseline", "profile"
    ):
        if args.get(key) is not None:
            merged[key] = args[key]

    return merged


def _first_defined(*values: Any) -> Any:
    """Return the first value that is not None (preserves 0, False, empty string)."""
    for v in values:
        if v is not None:
            return v
    return None


def _dict_to_config(d: dict[str, Any]) -> EvalAIConfig:
    return EvalAIConfig(
        evaluation_id=_first_defined(d.get("evaluationId"), d.get("evaluation_id")),
        api_key=_first_defined(d.get("apiKey"), d.get("api_key")),
        base_url=_first_defined(d.get("baseUrl"), d.get("base_url")),
        min_score=_first_defined(d.get("minScore"), d.get("min_score")),
        min_n=_first_defined(d.get("minN"), d.get("min_n")),
        max_drop=_first_defined(d.get("maxDrop"), d.get("max_drop")),
        warn_drop=_first_defined(d.get("warnDrop"), d.get("warn_drop")),
        allow_weak_evidence=_first_defined(d.get("allowWeakEvidence"), d.get("allow_weak_evidence")),
        baseline=d.get("baseline"),
        profile=d.get("profile"),
        packages=d.get("packages"),
    )


def _config_to_dict(c: EvalAIConfig) -> dict[str, Any]:
    return {k: v for k, v in {
        "evaluation_id": c.evaluation_id,
        "api_key": c.api_key,
        "base_url": c.base_url,
        "min_score": c.min_score,
        "min_n": c.min_n,
        "max_drop": c.max_drop,
        "warn_drop": c.warn_drop,
        "allow_weak_evidence": c.allow_weak_evidence,
        "baseline": c.baseline,
        "profile": c.profile,
    }.items() if v is not None}


def _load_from_pyproject(path: str, cwd: str | None) -> EvalAIConfig | None:
    """Load config from pyproject.toml [tool.evalgate] or [tool.evalai]."""
    try:
        import tomllib  # type: ignore[import-not-found]
    except ImportError:
        try:
            import tomli as tomllib  # type: ignore[no-redef]
        except ImportError:
            return None

    try:
        with open(path, "rb") as f:
            data = tomllib.load(f)
        tool = data.get("tool", {})
        cfg = tool.get("evalgate") or tool.get("evalai")
        if cfg:
            return _dict_to_config(cfg)
    except Exception:
        pass
    return None
