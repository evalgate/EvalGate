"""Standardized failure reason codes (T10).

Port of the TypeScript SDK's ``reason-codes.ts``.
"""

from __future__ import annotations

from typing import Literal

ReasonCode = Literal[
    "PASS",
    "WARN_REGRESSION",
    "LOW_SAMPLE_SIZE",
    "BASELINE_MISSING",
    "SCORE_TOO_LOW",
    "DELTA_TOO_HIGH",
    "COST_BUDGET_EXCEEDED",
    "LATENCY_BUDGET_EXCEEDED",
    "POLICY_FAILED",
    "UNKNOWN",
    # Legacy aliases
    "LOW_SCORE",
    "LOW_PASS_RATE",
    "SAFETY_RISK",
    "LATENCY_RISK",
    "COST_RISK",
    "MAX_DROP_EXCEEDED",
    "INSUFFICIENT_EVIDENCE",
    "POLICY_VIOLATION",
]

REASON_CODES: dict[str, dict[str, str]] = {
    "PASS": {"label": "Pass", "severity": "info", "description": "All checks passed."},
    "WARN_REGRESSION": {
        "label": "Warning: Regression", "severity": "warn",
        "description": "Score dropped but within tolerance."
    },
    "LOW_SAMPLE_SIZE": {
        "label": "Low Sample Size", "severity": "warn",
        "description": "Not enough data points for confidence."
    },
    "BASELINE_MISSING": {
        "label": "Baseline Missing", "severity": "warn",
        "description": "No baseline to compare against."
    },
    "SCORE_TOO_LOW": {
        "label": "Score Too Low", "severity": "fail",
        "description": "Score is below the minimum threshold."
    },
    "DELTA_TOO_HIGH": {
        "label": "Delta Too High", "severity": "fail",
        "description": "Score dropped more than the allowed delta."
    },
    "COST_BUDGET_EXCEEDED": {
        "label": "Cost Budget Exceeded", "severity": "fail",
        "description": "Evaluation cost exceeded the budget."
    },
    "LATENCY_BUDGET_EXCEEDED": {
        "label": "Latency Budget Exceeded", "severity": "fail",
        "description": "Response latency exceeded the limit."
    },
    "POLICY_FAILED": {"label": "Policy Failed", "severity": "fail", "description": "One or more policy checks failed."},
    "UNKNOWN": {"label": "Unknown", "severity": "fail", "description": "Unknown failure reason."},
    # Legacy aliases
    "LOW_SCORE": {
        "label": "Low Score", "severity": "fail",
        "description": "Score is below the minimum threshold."
    },
    "LOW_PASS_RATE": {
        "label": "Low Pass Rate", "severity": "fail",
        "description": "Pass rate is below the minimum threshold."
    },
    "SAFETY_RISK": {
        "label": "Safety Risk", "severity": "fail",
        "description": "Safety check failed."
    },
    "LATENCY_RISK": {
        "label": "Latency Risk", "severity": "warn",
        "description": "Latency is near or above the limit."
    },
    "COST_RISK": {
        "label": "Cost Risk", "severity": "warn",
        "description": "Cost is near or above the budget."
    },
    "MAX_DROP_EXCEEDED": {
        "label": "Max Drop Exceeded", "severity": "fail",
        "description": "Score dropped more than the allowed maximum."
    },
    "INSUFFICIENT_EVIDENCE": {
        "label": "Insufficient Evidence", "severity": "warn",
        "description": "Not enough data to make a determination."
    },
    "POLICY_VIOLATION": {
        "label": "Policy Violation", "severity": "fail",
        "description": "A policy was violated."
    },
}


def get_reason_info(code: str) -> dict[str, str]:
    """Get label, severity, and description for a reason code."""
    return REASON_CODES.get(code, REASON_CODES["UNKNOWN"])


def is_blocking(code: str) -> bool:
    """Return True if the reason code should block a deployment."""
    info = get_reason_info(code)
    return info["severity"] == "fail"
