"""Input normalization and hashing for deterministic matching.

Must match platform's input-hash logic for reportToEvalGate.
Port of ``utils/input-hash.ts``.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any


def _sort_keys(obj: dict[str, Any]) -> dict[str, Any]:
    """Recursively sort dictionary keys for stable serialization."""
    sorted_dict: dict[str, Any] = {}
    for k in sorted(obj.keys()):
        v = obj[k]
        if isinstance(v, dict):
            sorted_dict[k] = _sort_keys(v)
        else:
            sorted_dict[k] = v
    return sorted_dict


def normalize_input(input_str: str) -> str:
    """Normalize input for stable matching (whitespace, JSON key order)."""
    s = input_str.strip()
    try:
        obj = json.loads(s)
        if isinstance(obj, dict):
            return json.dumps(_sort_keys(obj), separators=(",", ":"))
        return json.dumps(obj, separators=(",", ":"))
    except (json.JSONDecodeError, TypeError):
        return re.sub(r"\s+", " ", s)


def sha256_input(s: str) -> str:
    """SHA-256 hash of normalized input."""
    normalized = normalize_input(s)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
