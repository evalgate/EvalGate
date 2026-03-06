"""Gate profile presets.

Extracted to avoid typer dependency in config.py imports.
"""

from __future__ import annotations

PROFILES = {
    "strict": {"min_score": 95, "max_drop": 0, "warn_drop": 0, "min_n": 30, "allow_weak_evidence": False},
    "balanced": {"min_score": 90, "max_drop": 2, "warn_drop": 1, "min_n": 10, "allow_weak_evidence": False},
    "fast": {"min_score": 85, "max_drop": 5, "warn_drop": 2, "min_n": 5, "allow_weak_evidence": True},
}
