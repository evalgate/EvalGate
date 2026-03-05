"""Centralized .evalgate workspace resolution.

Provides unified workspace path resolution for all EvalGate CLI commands.
Prefers .evalgate/; falls back to .evalai/ for backward compatibility.

Port of ``cli/workspace.ts``.
"""

from __future__ import annotations

import os
import warnings
from dataclasses import dataclass

_LEGACY_WARNING_SHOWN = False


@dataclass
class EvalWorkspace:
    """EvalGate workspace paths."""
    root: str
    eval_dir: str
    runs_dir: str
    manifest_path: str
    last_run_path: str
    index_path: str
    baseline_path: str


def resolve_eval_workspace(project_root: str | None = None) -> EvalWorkspace:
    """Resolve EvalGate workspace paths.

    Prefers ``.evalgate/``, falls back to ``.evalai/`` for legacy projects.
    """
    global _LEGACY_WARNING_SHOWN

    root = project_root or os.getcwd()
    evalgate_dir = os.path.join(root, ".evalgate")
    evalai_dir = os.path.join(root, ".evalai")

    use_legacy = os.path.isdir(evalai_dir) and not os.path.isdir(evalgate_dir)
    eval_dir = evalai_dir if use_legacy else evalgate_dir

    if use_legacy and not _LEGACY_WARNING_SHOWN:
        warnings.warn(
            "[EvalGate] Deprecation: .evalai/ is deprecated. "
            "Migrate to .evalgate/ (e.g. rename .evalai to .evalgate).",
            DeprecationWarning,
            stacklevel=2,
        )
        _LEGACY_WARNING_SHOWN = True

    runs_dir = os.path.join(eval_dir, "runs")

    return EvalWorkspace(
        root=root,
        eval_dir=eval_dir,
        runs_dir=runs_dir,
        manifest_path=os.path.join(eval_dir, "manifest.json"),
        last_run_path=os.path.join(eval_dir, "last-run.json"),
        index_path=os.path.join(runs_dir, "index.json"),
        baseline_path=os.path.join(eval_dir, "baseline-run.json"),
    )
