"""EvalGate Runtime Context — Layer 1 Foundation.

Execution context management for specifications.
Port of ``runtime/context.ts``.
"""

from __future__ import annotations

from typing import Any


def create_runtime_context(
    input: str,
    metadata: dict[str, Any] | None = None,
    options: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a new execution context."""
    return {
        "input": input,
        "metadata": metadata or {},
        "options": options,
    }


def merge_runtime_contexts(
    base: dict[str, Any],
    *overrides: dict[str, Any],
) -> dict[str, Any]:
    """Merge contexts with proper precedence. Later contexts override earlier ones."""
    if not base.get("input"):
        raise ValueError("Base context must have a valid input")

    merged = dict(base)
    for override in overrides:
        merged = {
            "input": override.get("input") or merged.get("input"),
            "metadata": {**(merged.get("metadata") or {}), **(override.get("metadata") or {})},
            "options": (
            {**(merged.get("options") or {}), **(override.get("options") or {})}
            if override.get("options") else merged.get("options")
        ),
        }
    return merged


def clone_runtime_context(context: dict[str, Any]) -> dict[str, Any]:
    """Clone a context for safe modification."""
    return {
        "input": context.get("input"),
        "metadata": dict(context.get("metadata") or {}),
        "options": dict(context.get("options") or {}) if context.get("options") else None,
    }


def validate_runtime_context(context: Any) -> None:
    """Validate context structure."""
    if not isinstance(context, dict):
        raise TypeError("Context must be a dict")

    if not isinstance(context.get("input"), str):
        raise TypeError("Context input must be a string")

    if context.get("metadata") is not None and not isinstance(context.get("metadata"), dict):
        raise TypeError("Context metadata must be a dict")

    if context.get("options") is not None and not isinstance(context.get("options"), dict):
        raise TypeError("Context options must be a dict")
