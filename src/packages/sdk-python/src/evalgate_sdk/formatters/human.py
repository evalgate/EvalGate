"""Human-readable output formatter."""

from __future__ import annotations

from typing import Any


def format_human(report: dict[str, Any]) -> str:
    """Format a check/run report as a human-readable string."""
    lines: list[str] = []
    verdict = report.get("verdict", report.get("summary", {}).get("success", "unknown"))
    eval_id = report.get("evaluationId", report.get("run_id", "?"))

    # Header
    if verdict == "pass" or verdict is True:
        lines.append(f"✅ PASS — {eval_id}")
    elif verdict == "warn":
        lines.append(f"⚠️  WARN — {eval_id}")
    else:
        lines.append(f"❌ FAIL — {eval_id}")

    lines.append("")

    # Summary
    summary = report.get("summary", {})
    if summary:
        total = summary.get("total", 0)
        passed = summary.get("passed", 0)
        failed = summary.get("failed", 0)
        pass_rate = summary.get("pass_rate", summary.get("passRate", 0))
        avg_score = summary.get("average_score", summary.get("averageScore", 0))
        duration = summary.get("total_duration_ms", summary.get("totalDurationMs", 0))

        lines.append(f"  Total:      {total}")
        lines.append(f"  Passed:     {passed}")
        lines.append(f"  Failed:     {failed}")
        lines.append(f"  Pass rate:  {pass_rate:.1f}%")
        lines.append(f"  Avg score:  {avg_score:.1f}")
        lines.append(f"  Duration:   {duration:.0f}ms")

    # Score
    score = report.get("score")
    if score is not None:
        lines.append(f"\n  Score:      {score}")

    baseline = report.get("baselineScore", report.get("baseline_score"))
    if baseline is not None:
        delta = report.get("delta", (score or 0) - baseline)
        lines.append(f"  Baseline:   {baseline}")
        lines.append(f"  Delta:      {delta:+.1f}")

    # Reason
    reason = report.get("reasonMessage", report.get("reason_message"))
    if reason:
        lines.append(f"\n  Reason: {reason}")

    # Failed cases
    failed_cases = report.get("failedCases", report.get("failed_cases", []))
    if failed_cases:
        lines.append(f"\n  Failed cases ({len(failed_cases)}):")
        for fc in failed_cases[:5]:
            name = fc.get("name", fc.get("test_name", "?"))
            reason_text = fc.get("reason", fc.get("message", ""))
            lines.append(f"    • {name}: {reason_text}")
        if len(failed_cases) > 5:
            lines.append(f"    ... and {len(failed_cases) - 5} more")

    return "\n".join(lines)
