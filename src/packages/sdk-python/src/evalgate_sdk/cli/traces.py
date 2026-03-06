"""Structured trace writer for evalgate runs.

Auto-writes structured JSON to .evalgate/traces/ on every define_eval result.
Each trace captures: spec identity, timing, assertions, score, and metadata.

Port of ``cli/traces.ts``.
"""

from __future__ import annotations

import json
import os
import platform
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class SpecTrace:
    """Individual spec trace record."""

    schema_version: int = 1
    timestamp: int = 0
    timestamp_iso: str = ""
    run_id: str = ""
    spec: dict[str, str] = field(default_factory=dict)
    execution: dict[str, Any] = field(default_factory=dict)
    git: dict[str, str] | None = None
    env: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "schemaVersion": self.schema_version,
            "timestamp": self.timestamp,
            "timestampISO": self.timestamp_iso,
            "runId": self.run_id,
            "spec": self.spec,
            "execution": self.execution,
            "env": self.env,
        }
        if self.git:
            d["git"] = self.git
        return d


@dataclass
class RunTrace:
    """Run-level trace summary."""

    schema_version: int = 1
    run: dict[str, Any] = field(default_factory=dict)
    summary: dict[str, Any] = field(default_factory=dict)
    latency: dict[str, Any] = field(default_factory=dict)
    specs: list[SpecTrace] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "schemaVersion": self.schema_version,
            "run": self.run,
            "summary": self.summary,
            "latency": self.latency,
            "specs": [s.to_dict() for s in self.specs],
        }


def calculate_percentiles(durations: list[float]) -> dict[str, float]:
    """Calculate latency percentiles from durations."""
    if not durations:
        return {"min": 0, "max": 0, "mean": 0, "p50": 0, "p95": 0, "p99": 0}

    sorted_d = sorted(durations)
    n = len(sorted_d)
    total = sum(sorted_d)

    return {
        "min": sorted_d[0],
        "max": sorted_d[-1],
        "mean": round(total / n),
        "p50": sorted_d[int(n * 0.5)],
        "p95": sorted_d[min(int(n * 0.95), n - 1)],
        "p99": sorted_d[min(int(n * 0.99), n - 1)],
    }


def build_run_trace(
    result: dict[str, Any],
    git_info: dict[str, str] | None = None,
) -> RunTrace:
    """Build a RunTrace from a run result dict."""
    now = int(time.time() * 1000)
    is_ci = bool(os.environ.get("CI") or os.environ.get("GITHUB_ACTIONS") or os.environ.get("GITLAB_CI"))

    run_id = result.get("run_id", result.get("runId", "unknown"))
    results_list = result.get("results", [])
    metadata = result.get("metadata", {})
    summary = result.get("summary", {})

    spec_traces: list[SpecTrace] = []
    for spec in results_list:
        spec_result = spec.get("result", spec)
        spec_traces.append(
            SpecTrace(
                timestamp=now,
                timestamp_iso=datetime.now(timezone.utc).isoformat(),
                run_id=run_id,
                spec={
                    "id": spec.get("spec_id", spec.get("specId", "")),
                    "name": spec.get("name", ""),
                    "filePath": spec.get("file_path", spec.get("filePath", "")),
                },
                execution={
                    "status": spec_result.get("status", "unknown"),
                    "score": spec_result.get("score"),
                    "duration": spec_result.get("duration", spec_result.get("duration_ms", 0)),
                    "error": spec_result.get("error"),
                },
                git=git_info,
                env={
                    "pythonVersion": sys.version.split()[0],
                    "platform": platform.system().lower(),
                    "ci": is_ci,
                },
            )
        )

    durations = [s.execution.get("duration", 0) for s in spec_traces if s.execution.get("status") != "skipped"]
    latency = calculate_percentiles(durations)

    return RunTrace(
        run={
            "id": run_id,
            "startedAt": metadata.get("started_at", metadata.get("startedAt", now)),
            "completedAt": metadata.get("completed_at", metadata.get("completedAt", now)),
            "duration": metadata.get("duration", 0),
            "mode": metadata.get("mode", "spec"),
        },
        summary={
            "total": len(results_list),
            "passed": summary.get("passed", 0),
            "failed": summary.get("failed", 0),
            "skipped": summary.get("skipped", 0),
            "passRate": summary.get("pass_rate", summary.get("passRate", 0)),
        },
        latency=latency,
        specs=spec_traces,
    )


async def write_traces(
    result: dict[str, Any],
    project_root: str | None = None,
    git_info: dict[str, str] | None = None,
) -> str:
    """Write structured trace files to .evalgate/traces/."""
    root = project_root or os.getcwd()
    traces_dir = os.path.join(root, ".evalgate", "traces")
    os.makedirs(traces_dir, exist_ok=True)

    run_trace = build_run_trace(result, git_info)
    run_id = run_trace.run.get("id", "unknown")

    trace_file = os.path.join(traces_dir, f"{run_id}.trace.json")
    Path(trace_file).write_text(json.dumps(run_trace.to_dict(), indent=2), encoding="utf-8")

    latest_file = os.path.join(traces_dir, "latest.trace.json")
    Path(latest_file).write_text(json.dumps(run_trace.to_dict(), indent=2), encoding="utf-8")

    return trace_file


def format_latency_table(latency: dict[str, Any]) -> str:
    """Format latency percentiles for human display."""
    lines = [
        "⏱️  Latency Percentiles:",
        f"   min:  {latency.get('min', 0)}ms",
        f"   p50:  {latency.get('p50', 0)}ms",
        f"   p95:  {latency.get('p95', 0)}ms",
        f"   p99:  {latency.get('p99', 0)}ms",
        f"   max:  {latency.get('max', 0)}ms",
        f"   mean: {latency.get('mean', 0)}ms",
    ]
    return "\n".join(lines)
