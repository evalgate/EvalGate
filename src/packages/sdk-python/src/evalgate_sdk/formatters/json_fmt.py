"""JSON output formatter."""

from __future__ import annotations

import json
from typing import Any


def format_json(report: dict[str, Any], *, indent: int = 2) -> str:
    """Format a check/run report as a JSON string."""
    return json.dumps(report, indent=indent, default=str)
