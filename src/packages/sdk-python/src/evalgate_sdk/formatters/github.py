"""GitHub Actions output formatter."""

from __future__ import annotations

from typing import Any


def format_github(report: dict[str, Any]) -> str:
    """Format a check/run report as GitHub Actions workflow commands.

    Uses ``::error``, ``::warning``, and ``::notice`` annotations.
    """
    lines: list[str] = []
    verdict = report.get("verdict", "unknown")
    eval_id = report.get("evaluationId", report.get("run_id", "?"))
    score = report.get("score")
    reason = report.get("reasonMessage", report.get("reason_message", ""))

    # Summary annotation
    if verdict == "pass":
        lines.append(f"::notice title=EvalGate Pass::Evaluation {eval_id} passed (score={score})")
    elif verdict == "warn":
        lines.append(f"::warning title=EvalGate Warning::Evaluation {eval_id}: {reason}")
    else:
        lines.append(f"::error title=EvalGate Fail::Evaluation {eval_id} failed: {reason}")

    # Set output variables via GITHUB_OUTPUT (::set-output is deprecated since Oct 2022)
    import os
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        try:
            with open(github_output, "a") as f:
                f.write(f"verdict={verdict}\n")
                if score is not None:
                    f.write(f"score={score}\n")
        except OSError:
            pass

    # Failed cases as annotations
    failed_cases = report.get("failedCases", report.get("failed_cases", []))
    for fc in failed_cases[:10]:
        name = fc.get("name", fc.get("test_name", "?"))
        msg = fc.get("reason", fc.get("message", "failed"))
        file_path = fc.get("file_path", fc.get("filePath", ""))
        if file_path:
            lines.append(f"::error file={file_path}::{name}: {msg}")
        else:
            lines.append(f"::error::{name}: {msg}")

    return "\n".join(lines)
