"""CheckReport and related types for formatters.

Port of ``cli/formatters/types.ts``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

GateVerdict = Literal["pass", "warn", "fail"]
GateMode = Literal["enforced", "neutral"]

FailureReasonCode = Literal[
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
    "LOW_SCORE",
    "LOW_PASS_RATE",
    "SAFETY_RISK",
    "LATENCY_RISK",
    "COST_RISK",
    "MAX_DROP_EXCEEDED",
    "INSUFFICIENT_EVIDENCE",
    "POLICY_VIOLATION",
]

CHECK_REPORT_SCHEMA_VERSION = 1


@dataclass
class ScoreBreakdown01:
    pass_rate: float | None = None
    safety: float | None = None
    judge: float | None = None
    schema: float | None = None
    latency: float | None = None
    cost: float | None = None


@dataclass
class ScoreContribPts:
    pass_rate_pts: float | None = None
    safety_pts: float | None = None
    compliance_pts: float | None = None
    performance_pts: float | None = None


@dataclass
class GateThresholds:
    min_score: float | None = None
    min_pass_rate: float | None = None
    min_safety: float | None = None
    max_drop: float | None = None
    warn_drop: float | None = None
    min_n: int | None = None
    allow_weak_evidence: bool | None = None
    baseline: str | None = None
    max_cost_usd: float | None = None
    max_latency_ms: float | None = None
    max_cost_delta_usd: float | None = None


@dataclass
class FailedCase:
    test_case_id: int | None = None
    status: str | None = None
    name: str | None = None
    input: str | None = None
    input_snippet: str | None = None
    expected_output: str | None = None
    expected_snippet: str | None = None
    output: str | None = None
    output_snippet: str | None = None
    reason: str | None = None


@dataclass
class CiContext:
    provider: str | None = None
    repo: str | None = None
    sha: str | None = None
    branch: str | None = None
    pr: int | None = None
    run_url: str | None = None
    actor: str | None = None


@dataclass
class CheckReport:
    evaluation_id: str = ""
    verdict: GateVerdict = "fail"
    gate_applied: bool = True
    gate_mode: GateMode = "enforced"
    reason_code: str = "UNKNOWN"
    schema_version: int = CHECK_REPORT_SCHEMA_VERSION
    run_id: int | None = None
    actionable_message: str | None = None
    reason_message: str | None = None
    score: float | None = None
    baseline_score: float | None = None
    delta: float | None = None
    pass_rate: float | None = None
    safety_pass_rate: float | None = None
    flags: list[str] | None = None
    breakdown_01: ScoreBreakdown01 | None = None
    contrib_pts: ScoreContribPts | None = None
    thresholds: GateThresholds | None = None
    n: int | None = None
    evidence_level: str | None = None
    baseline_missing: bool | None = None
    baseline_status: str | None = None
    dashboard_url: str | None = None
    failed_cases: list[FailedCase] = field(default_factory=list)
    failed_cases_shown: int | None = None
    failed_cases_more: int | None = None
    request_id: str | None = None
    duration_ms: float | None = None
    ci: CiContext | None = None
    explain: bool | None = None
    share_url: str | None = None
    policy: str | None = None
    baseline_run_id: int | None = None
    ci_run_url: str | None = None
    policy_evidence: dict[str, Any] | None = None
