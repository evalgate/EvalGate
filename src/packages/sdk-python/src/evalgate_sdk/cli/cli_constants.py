"""Standardized exit codes for evalgate check.

Port of ``cli/constants.ts``.
"""

from __future__ import annotations


class EXIT:
    """Exit code constants for CLI commands."""
    PASS = 0
    SCORE_BELOW = 1
    REGRESSION = 2
    POLICY_VIOLATION = 3
    API_ERROR = 4
    BAD_ARGS = 5
    LOW_N = 6
    WEAK_EVIDENCE = 7
    WARN_REGRESSION = 8
