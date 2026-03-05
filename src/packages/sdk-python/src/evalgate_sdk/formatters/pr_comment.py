"""PR comment formatter — Markdown output for pull request comments."""

from __future__ import annotations

from typing import Any


def format_pr_comment(report: dict[str, Any]) -> str:
    """Format a check/run report as a Markdown PR comment."""
    lines: list[str] = []
    verdict = report.get("verdict", "unknown")
    eval_id = report.get("evaluationId", report.get("run_id", "?"))
    score = report.get("score")
    reason = report.get("reasonMessage", report.get("reason_message", ""))

    # Header
    if verdict == "pass":
        lines.append("## ✅ EvalGate: Pass")
    elif verdict == "warn":
        lines.append("## ⚠️ EvalGate: Warning")
    else:
        lines.append("## ❌ EvalGate: Fail")

    lines.append("")

    # Summary table
    summary = report.get("summary", {})
    if summary:
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        lines.append(f"| Total | {summary.get('total', 0)} |")
        lines.append(f"| Passed | {summary.get('passed', 0)} |")
        lines.append(f"| Failed | {summary.get('failed', 0)} |")
        pr = summary.get("pass_rate", summary.get("passRate", 0))
        lines.append(f"| Pass Rate | {pr:.1f}% |")
        avg = summary.get("average_score", summary.get("averageScore", 0))
        lines.append(f"| Avg Score | {avg:.1f} |")
        lines.append("")

    # Score + baseline
    if score is not None:
        baseline = report.get("baselineScore", report.get("baseline_score"))
        if baseline is not None:
            delta = report.get("delta", score - baseline)
            sign = "+" if delta >= 0 else ""
            lines.append(f"**Score:** {score} (baseline: {baseline}, delta: {sign}{delta:.1f})")
        else:
            lines.append(f"**Score:** {score}")
        lines.append("")

    # Reason
    if reason:
        lines.append(f"> {reason}")
        lines.append("")

    # Failed cases
    failed_cases = report.get("failedCases", report.get("failed_cases", []))
    if failed_cases:
        lines.append("<details>")
        lines.append(f"<summary>Failed cases ({len(failed_cases)})</summary>")
        lines.append("")
        for fc in failed_cases[:20]:
            name = fc.get("name", fc.get("test_name", "?"))
            msg = fc.get("reason", fc.get("message", ""))
            lines.append(f"- **{name}**: {msg}")
        if len(failed_cases) > 20:
            lines.append(f"- ... and {len(failed_cases) - 20} more")
        lines.append("")
        lines.append("</details>")
        lines.append("")

    # Dashboard link
    dashboard = report.get("dashboardUrl", report.get("dashboard_url"))
    if dashboard:
        lines.append(f"[View in dashboard]({dashboard})")

    # Footer
    lines.append(f"\n<sub>Evaluation: {eval_id}</sub>")

    return "\n".join(lines)
