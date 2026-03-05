"""Build CheckReport from API data and gate result.

Normalizes failed cases (truncate, sort), dashboard URL, top N + more.

Port of ``cli/report/build-check-report.ts``.
"""

from __future__ import annotations

from typing import Any

from evalgate_sdk.cli.formatters.types import (
    CHECK_REPORT_SCHEMA_VERSION,
    CheckReport,
    FailedCase,
    GateThresholds,
    ScoreBreakdown01,
    ScoreContribPts,
)
from evalgate_sdk.cli.render.snippet import truncate_snippet
from evalgate_sdk.cli.render.sort import sort_failed_cases

TOP_N = 3
SNIPPET_MAX = 50


def compute_contrib_pts(b: ScoreBreakdown01) -> ScoreContribPts:
    """ContribPts from weights: passRate*50, safety*25, (0.6*judge+0.4*schema)*15, (0.6*latency+0.4*cost)*10."""
    pr = b.pass_rate or 0
    s = b.safety or 0
    j = b.judge or 0
    sc = b.schema or 0
    lat = b.latency or 0
    c = b.cost or 0
    return ScoreContribPts(
        pass_rate_pts=round(pr * 50 * 10) / 10,
        safety_pts=round(s * 25 * 10) / 10,
        compliance_pts=round((0.6 * j + 0.4 * sc) * 15 * 10) / 10,
        performance_pts=round((0.6 * lat + 0.4 * c) * 10 * 10) / 10,
    )


def build_check_report(
    evaluation_id: str,
    quality: dict[str, Any],
    gate_result: dict[str, Any],
    base_url: str = "",
    run_details: dict[str, Any] | None = None,
    request_id: str | None = None,
    share_url: str | None = None,
    baseline_run_id: int | None = None,
    ci_run_url: str | None = None,
    explain: bool = False,
    policy: str | None = None,
    min_score: float | None = None,
    max_drop: float | None = None,
    warn_drop: float | None = None,
    min_n: int | None = None,
    allow_weak_evidence: bool | None = None,
    baseline: str | None = None,
    max_cost_usd: float | None = None,
    max_latency_ms: float | None = None,
    max_cost_delta_usd: float | None = None,
) -> CheckReport:
    """Build a CheckReport from API data and gate result."""
    score = quality.get("score", 0)
    total = quality.get("total")
    baseline_score = quality.get("baselineScore") or quality.get("baseline_score")
    regression_delta = quality.get("regressionDelta") or quality.get("regression_delta")
    evaluation_run_id = quality.get("evaluationRunId") or quality.get("evaluation_run_id")
    breakdown = quality.get("breakdown", {})
    flags = sorted(quality.get("flags", []))

    dashboard_url = None
    if evaluation_run_id is not None:
        clean_base = base_url.rstrip("/")
        dashboard_url = f"{clean_base}/evaluations/{evaluation_id}/runs/{evaluation_run_id}"

    # Build failed cases from run details
    failed_cases: list[FailedCase] = []
    if run_details and run_details.get("results") and evaluation_run_id is not None:
        raw = []
        for r in run_details["results"]:
            if r.get("status") == "failed":
                tc = r.get("test_cases", {})
                raw.append({
                    "test_case_id": r.get("testCaseId") or r.get("test_case_id"),
                    "status": "failed",
                    "name": tc.get("name"),
                    "input": tc.get("input"),
                    "expected_output": tc.get("expectedOutput") or tc.get("expected_output"),
                    "output": r.get("output"),
                })

        sorted_raw = sort_failed_cases(raw)
        for fc in sorted_raw:
            failed_cases.append(FailedCase(
                test_case_id=fc.get("test_case_id"),
                status="failed",
                name=fc.get("name"),
                input=fc.get("input"),
                input_snippet=truncate_snippet(fc.get("input"), SNIPPET_MAX),
                expected_output=fc.get("expected_output"),
                expected_snippet=truncate_snippet(fc.get("expected_output"), SNIPPET_MAX),
                output=fc.get("output"),
                output_snippet=truncate_snippet(fc.get("output"), SNIPPET_MAX),
            ))

    failed_cases_shown = min(len(failed_cases), TOP_N) if failed_cases else None
    failed_cases_more = (len(failed_cases) - TOP_N) if len(failed_cases) > TOP_N else None

    gate_skipped = gate_result.get("gate_skipped", gate_result.get("gateSkipped", False))
    gate_applied = not gate_skipped
    gate_mode = "neutral" if gate_skipped else "enforced"
    reason_code = gate_result.get("reason_code", gate_result.get("reasonCode", "UNKNOWN"))

    if reason_code == "WARN_REGRESSION":
        verdict = "warn"
    elif gate_result.get("passed"):
        verdict = "pass"
    else:
        verdict = "fail"

    actionable_message = None
    if gate_skipped:
        actionable_message = (
            "Gate not applied: baseline missing. Publish a baseline from the dashboard, "
            "or run with --baseline previous once you have runs."
        )
    else:
        actionable_message = gate_result.get("reason_message") or gate_result.get("reasonMessage")

    breakdown_01 = None
    if breakdown:
        breakdown_01 = ScoreBreakdown01(
            pass_rate=breakdown.get("passRate"),
            safety=breakdown.get("safety"),
            judge=breakdown.get("judge"),
            schema=breakdown.get("schema"),
            latency=breakdown.get("latency"),
            cost=breakdown.get("cost"),
        )

    contrib_pts = None
    if explain and breakdown_01:
        contrib_pts = compute_contrib_pts(breakdown_01)

    thresholds = GateThresholds(
        min_score=min_score,
        max_drop=max_drop,
        warn_drop=warn_drop,
        min_n=min_n,
        allow_weak_evidence=allow_weak_evidence,
        baseline=baseline,
        max_cost_usd=max_cost_usd,
        max_latency_ms=max_latency_ms,
        max_cost_delta_usd=max_cost_delta_usd,
    )

    policy_evidence = None
    if explain and gate_result.get("policy_evidence", gate_result.get("policyEvidence")):
        pe = gate_result.get("policy_evidence") or gate_result.get("policyEvidence")
        policy_evidence = {
            "failedCheck": pe.get("failed_check") or pe.get("failedCheck"),
            "remediation": pe.get("remediation"),
            "snapshot": pe.get("snapshot"),
        }

    return CheckReport(
        schema_version=CHECK_REPORT_SCHEMA_VERSION,
        evaluation_id=evaluation_id,
        run_id=evaluation_run_id,
        verdict=verdict,
        gate_applied=gate_applied,
        gate_mode=gate_mode,
        actionable_message=actionable_message,
        share_url=share_url,
        policy=policy,
        baseline_run_id=baseline_run_id or quality.get("baselineRunId") or quality.get("baseline_run_id"),
        ci_run_url=ci_run_url,
        reason_code=reason_code,
        reason_message=gate_result.get("reason_message") or gate_result.get("reasonMessage"),
        score=score,
        baseline_score=baseline_score,
        delta=regression_delta,
        n=total,
        evidence_level=quality.get("evidenceLevel") or quality.get("evidence_level"),
        baseline_missing=quality.get("baselineMissing") or quality.get("baseline_missing"),
        baseline_status=(
            "missing" if quality.get("baselineMissing") or quality.get("baseline_missing") 
            else ("found" if baseline_score is not None else None)
        ),
        flags=flags if flags else None,
        breakdown_01=breakdown_01,
        contrib_pts=contrib_pts,
        thresholds=thresholds,
        dashboard_url=dashboard_url,
        failed_cases=failed_cases,
        failed_cases_shown=failed_cases_shown,
        failed_cases_more=failed_cases_more if failed_cases_more and failed_cases_more > 0 else None,
        request_id=request_id,
        explain=explain if explain else None,
        policy_evidence=policy_evidence,
    )
