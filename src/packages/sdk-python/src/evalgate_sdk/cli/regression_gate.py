"""evalgate gate — Run the regression gate.

Two modes:
  1. Project mode: delegates to eval:regression-gate script (full gate)
  2. Built-in mode: runs tests, compares against baseline

Port of ``cli/regression-gate.ts``.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal


@dataclass
class GateArgs:
    format: Literal["human", "json", "github"] = "human"


@dataclass
class BuiltinReport:
    schema_version: int = 1
    timestamp: str = ""
    exit_code: int = 0
    category: str = "pass"
    passed: bool = True
    failures: list[str] = field(default_factory=list)
    deltas: list[dict[str, Any]] = field(default_factory=list)
    baseline: dict[str, str] | None = None
    duration_ms: int = 0
    command: str = ""
    runner: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "schemaVersion": self.schema_version,
            "timestamp": self.timestamp,
            "exitCode": self.exit_code,
            "category": self.category,
            "passed": self.passed,
            "failures": self.failures,
            "deltas": self.deltas,
            "baseline": self.baseline,
            "durationMs": self.duration_ms,
            "command": self.command,
            "runner": self.runner,
        }


def parse_gate_args(argv: list[str]) -> GateArgs:
    args = GateArgs()
    i = 0
    while i < len(argv):
        if argv[i] == "--format" and i + 1 < len(argv):
            fmt = argv[i + 1]
            if fmt in ("human", "json", "github"):
                args.format = fmt  # type: ignore[assignment]
            i += 2
        else:
            i += 1
    return args


def _detect_test_runner(cwd: str) -> str:
    """Detect Python test runner used in the project."""
    pyproject = os.path.join(cwd, "pyproject.toml")
    if os.path.isfile(pyproject):
        try:
            text = Path(pyproject).read_text(encoding="utf-8")
            if "pytest" in text:
                return "pytest"
            if "unittest" in text:
                return "unittest"
        except OSError:
            pass

    if os.path.isfile(os.path.join(cwd, "pytest.ini")) or os.path.isfile(os.path.join(cwd, "setup.cfg")):
        return "pytest"

    return "pytest"


def _detect_test_command(cwd: str) -> str:
    """Detect the test command to run."""
    runner = _detect_test_runner(cwd)
    if runner == "pytest":
        return "python -m pytest"
    return "python -m unittest discover"


def run_builtin_gate(cwd: str) -> BuiltinReport:
    """Run the built-in lightweight gate."""
    t0 = time.time()
    now = datetime.now(timezone.utc).isoformat()
    command = _detect_test_command(cwd)
    runner = _detect_test_runner(cwd)
    baseline_path = os.path.join(cwd, "evals", "baseline.json")

    if not os.path.isfile(baseline_path):
        return BuiltinReport(
            timestamp=now,
            exit_code=2,
            category="infra_error",
            passed=False,
            failures=["Baseline file not found. Run: evalgate init"],
            duration_ms=int((time.time() - t0) * 1000),
            command=command,
            runner=runner,
        )

    try:
        baseline_data = json.loads(Path(baseline_path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return BuiltinReport(
            timestamp=now,
            exit_code=2,
            category="infra_error",
            passed=False,
            failures=["Failed to parse evals/baseline.json"],
            duration_ms=int((time.time() - t0) * 1000),
            command=command,
            runner=runner,
        )

    baseline_meta = None
    if baseline_data.get("updatedAt"):
        baseline_meta = {
            "updatedAt": baseline_data["updatedAt"],
            "updatedBy": baseline_data.get("updatedBy", "unknown"),
        }

    # Run tests
    try:
        result = subprocess.run(
            command.split(),
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=300,
        )
    except subprocess.TimeoutExpired:
        return BuiltinReport(
            timestamp=now,
            exit_code=2,
            category="infra_error",
            passed=False,
            failures=["Test command timed out after 300s"],
            duration_ms=int((time.time() - t0) * 1000),
            command=command,
            runner=runner,
        )
    except OSError as exc:
        return BuiltinReport(
            timestamp=now,
            exit_code=2,
            category="infra_error",
            passed=False,
            failures=[f"Failed to run test command: {exc}"],
            duration_ms=int((time.time() - t0) * 1000),
            command=command,
            runner=runner,
        )

    tests_passed = result.returncode == 0
    output = (result.stdout or "") + (result.stderr or "")

    # Extract test count
    test_count = 0
    count_match = (
        re.search(r"(\d+)\s+(?:tests?|specs?)\s+(?:passed|completed)", output, re.I)
        or re.search(r"(\d+)\s+passed", output, re.I)
        or re.search(r"(\d+)\s+passing", output, re.I)
    )
    if count_match:
        test_count = int(count_match.group(1))

    baseline_passed = baseline_data.get("confidenceTests", {}).get("passed", True)
    baseline_total = baseline_data.get("confidenceTests", {}).get("total", 0)

    failures: list[str] = []
    deltas: list[dict[str, Any]] = []

    deltas.append(
        {
            "metric": "tests_passing",
            "baseline": baseline_passed,
            "current": tests_passed,
            "delta": "0" if tests_passed == baseline_passed else ("+1" if tests_passed else "-1"),
            "status": "pass" if tests_passed else "fail",
        }
    )

    if not tests_passed and baseline_passed:
        failures.append("Tests were passing in baseline but are now failing")

    if test_count > 0 or baseline_total > 0:
        count_delta = test_count - baseline_total
        deltas.append(
            {
                "metric": "test_count",
                "baseline": baseline_total,
                "current": test_count,
                "delta": f"+{count_delta}" if count_delta >= 0 else str(count_delta),
                "status": "pass" if test_count >= baseline_total else "fail",
            }
        )
        if test_count < baseline_total:
            failures.append(f"Test count dropped from {baseline_total} to {test_count} ({count_delta})")

    has_regression = len(failures) > 0

    return BuiltinReport(
        timestamp=now,
        exit_code=1 if has_regression else 0,
        category="regression" if has_regression else "pass",
        passed=not has_regression,
        failures=failures,
        deltas=deltas,
        baseline=baseline_meta,
        duration_ms=int((time.time() - t0) * 1000),
        command=command,
        runner=runner,
    )


def format_human(report: BuiltinReport) -> str:
    """Format report for human consumption."""
    icon = "✅" if report.passed else "❌"
    lines = [f"\n{icon} EvalGate Gate: {report.category.upper()}\n"]

    if report.deltas:

        def pad(s, n):
            return str(s).ljust(n)

        lines.append(f"  {pad('Metric', 16)} {pad('Baseline', 10)} {pad('Current', 10)} {pad('Delta', 8)} Status")
        lines.append(f"  {'-' * 16} {'-' * 10} {'-' * 10} {'-' * 8} ------")
        for d in report.deltas:
            si = "✔" if d["status"] == "pass" else "✖"
            lines.append(
                f"  {pad(d['metric'], 16)} {pad(d['baseline'], 10)} {pad(d['current'], 10)} {pad(d['delta'], 8)} {si}"
            )

    if report.failures:
        lines.append("\n  Failures:")
        for f in report.failures:
            lines.append(f"    • {f}")
    lines.append("")

    return "\n".join(lines)


def format_github(report: BuiltinReport) -> str:
    """Format report as GitHub markdown."""
    icon = "✅" if report.passed else "❌"
    lines = [
        f"## {icon} EvalGate Gate: {report.category}",
        "",
        "| Metric | Baseline | Current | Delta | Status |",
        "|--------|----------|---------|-------|--------|",
    ]
    for d in report.deltas:
        si = "✅" if d["status"] == "pass" else "❌"
        lines.append(f"| {d['metric']} | {d['baseline']} | {d['current']} | {d['delta']} | {si} |")

    if report.failures:
        lines.extend(["", "### Failures", ""])
        for f in report.failures:
            lines.append(f"- {f}")

    lines.append(f"\nSchema version: {report.schema_version}")
    return "\n".join(lines)


def run_gate(argv: list[str] | None = None) -> int:
    """Main gate entry point. Returns exit code."""
    cwd = os.getcwd()
    args = parse_gate_args(argv or [])
    report = run_builtin_gate(cwd)

    # Write report artifact
    evals_dir = os.path.join(cwd, "evals")
    os.makedirs(evals_dir, exist_ok=True)
    Path(os.path.join(cwd, "evals", "regression-report.json")).write_text(
        json.dumps(report.to_dict(), indent=2) + "\n",
        encoding="utf-8",
    )

    if args.format == "json":
        print(json.dumps(report.to_dict(), indent=2))
    elif args.format == "github":
        md = format_github(report)
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            try:
                with open(summary_path, "a") as f:
                    f.write(md + "\n")
            except OSError:
                pass
        print(md)
    else:
        print(format_human(report))

    return report.exit_code
