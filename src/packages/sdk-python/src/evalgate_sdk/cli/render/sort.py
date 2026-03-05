"""Deterministic ordering for failed cases.

Sort by status severity (failed > error > skipped > passed), then by test_case_id asc.

Port of ``cli/render/sort.ts``.
"""

from __future__ import annotations

from typing import Any

STATUS_SEVERITY: dict[str, int] = {
    "failed": 0,
    "error": 1,
    "skipped": 2,
    "passed": 3,
}


def sort_failed_cases(cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sort cases by status severity then test_case_id."""
    def sort_key(c: dict[str, Any]) -> tuple[int, int]:
        status = (c.get("status") or "").lower()
        sev = STATUS_SEVERITY.get(status, 4)
        tid = c.get("test_case_id") or c.get("testCaseId") or 0
        return (sev, tid)

    return sorted(cases, key=sort_key)
