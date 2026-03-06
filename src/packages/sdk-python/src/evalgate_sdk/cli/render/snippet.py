"""Truncate a string for deterministic output.

Port of ``cli/render/snippet.ts``.
"""

from __future__ import annotations

import re


def truncate_snippet(s: str | None, max_len: int = 140) -> str:
    """Replaces newlines with space, caps length."""
    if s is None:
        return ""
    normalized = re.sub(r"\s+", " ", s).strip()
    if len(normalized) <= max_len:
        return normalized
    return normalized[:max_len] + "…"
