"""Deterministic RunReport serialization (T4).

Port of the TypeScript SDK's ``run-report.ts``.
Provides a stable report format for downstream processing (explain, diff, history).
"""

from __future__ import annotations

import json
import platform
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

RUN_REPORT_SCHEMA_VERSION = "1"


@dataclass
class RunResult:
    """Individual test result."""

    test_id: str
    test_name: str
    file_path: str
    position: dict[str, int]
    input: str
    passed: bool
    score: float
    duration_ms: float
    metadata: dict[str, Any] | None = None
    tags: list[str] = field(default_factory=list)
    assertions: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class RunFailure:
    """Failure or error information."""

    test_id: str
    test_name: str
    file_path: str
    position: dict[str, int]
    classification: str  # "failed" | "error" | "timeout"
    message: str
    timestamp: str = ""
    error_envelope: dict[str, Any] | None = None


@dataclass
class RunSummary:
    """Execution summary statistics."""

    total: int = 0
    passed: int = 0
    failed: int = 0
    errors: int = 0
    timeouts: int = 0
    pass_rate: float = 0.0
    average_score: float = 0.0
    total_duration_ms: float = 0.0
    success: bool = True


@dataclass
class RunConfig:
    """Execution configuration."""

    executor_type: str = "local"
    max_parallel: int | None = None
    default_timeout: int = 30_000
    environment: dict[str, str] = field(default_factory=dict)


@dataclass
class RunReport:
    """Main run report structure."""

    schema_version: str = RUN_REPORT_SCHEMA_VERSION
    run_id: str = ""
    started_at: str = ""
    finished_at: str = ""
    runtime: dict[str, str] = field(default_factory=dict)
    results: list[RunResult] = field(default_factory=list)
    failures: list[RunFailure] = field(default_factory=list)
    summary: RunSummary = field(default_factory=RunSummary)
    config: RunConfig = field(default_factory=RunConfig)

    def to_json(self) -> str:
        """Serialize to deterministic JSON string."""
        return json.dumps(asdict(self), indent=2, default=str)


class RunReportBuilder:
    """Builder for creating deterministic RunReport instances."""

    def __init__(
        self,
        run_id: str,
        runtime_info: dict[str, str],
    ) -> None:
        self._report = RunReport(
            run_id=run_id,
            started_at=datetime.now(timezone.utc).isoformat(),
            runtime=runtime_info,
            config=RunConfig(
                environment={
                    "python_version": sys.version.split()[0],
                    "platform": platform.system().lower(),
                    "arch": platform.machine(),
                },
            ),
        )
        self._scores: list[float] = []

    def add_result(
        self,
        test_id: str,
        test_name: str,
        file_path: str,
        position: dict[str, int],
        input: str,
        *,
        passed: bool,
        score: float,
        duration_ms: float = 0.0,
        metadata: dict[str, Any] | None = None,
        tags: list[str] | None = None,
        assertions: list[dict[str, Any]] | None = None,
        classification: str = "passed",
        error: str | None = None,
        error_envelope: dict[str, Any] | None = None,
    ) -> None:
        """Add a test result to the report."""
        result = RunResult(
            test_id=test_id,
            test_name=test_name,
            file_path=file_path,
            position=position,
            input=input,
            passed=passed,
            score=score,
            duration_ms=duration_ms,
            metadata=metadata,
            tags=tags or [],
            assertions=assertions or [],
        )
        self._report.results.append(result)

        # Update summary
        s = self._report.summary
        s.total += 1
        s.total_duration_ms += duration_ms

        if passed:
            s.passed += 1
        elif classification == "error":
            s.errors += 1
            s.success = False
        elif classification == "timeout":
            s.timeouts += 1
            s.success = False
        else:
            s.failed += 1
            s.success = False

        s.pass_rate = (s.passed / s.total * 100) if s.total > 0 else 0.0
        if score > 0:
            self._scores.append(score)
        s.average_score = (sum(self._scores) / len(self._scores)) if self._scores else 0.0

        # Add to failures if needed
        if not passed or classification in ("error", "timeout"):
            failure = RunFailure(
                test_id=test_id,
                test_name=test_name,
                file_path=file_path,
                position=position,
                classification=classification if classification in ("error", "timeout") else "failed",
                message=error or "Test failed",
                timestamp=datetime.now(timezone.utc).isoformat(),
                error_envelope=error_envelope,
            )
            self._report.failures.append(failure)

    def set_config(self, **kwargs: Any) -> None:
        """Update execution configuration fields."""
        for key, value in kwargs.items():
            if hasattr(self._report.config, key):
                setattr(self._report.config, key, value)

    def build(self) -> RunReport:
        """Finalize and return the complete report."""
        # Sort for determinism
        self._report.results.sort(key=lambda r: r.test_id)
        self._report.failures.sort(key=lambda f: f.test_id)
        self._report.finished_at = datetime.now(timezone.utc).isoformat()
        return self._report

    def to_json(self) -> str:
        """Build and serialize to JSON."""
        return self.build().to_json()

    async def write_to_file(self, file_path: str) -> None:
        """Write report to file."""
        from pathlib import Path

        Path(file_path).write_text(self.to_json(), encoding="utf-8")


def create_run_report(
    run_id: str,
    runtime_info: dict[str, str],
) -> RunReportBuilder:
    """Create a new RunReport builder."""
    return RunReportBuilder(run_id, runtime_info)


def _filter_dataclass_fields(cls: type, d: dict[str, Any]) -> dict[str, Any]:
    """Keep only keys that match dataclass field names — prevents TypeError on extras."""
    import dataclasses
    valid = {f.name for f in dataclasses.fields(cls)}
    return {k: v for k, v in d.items() if k in valid}


def parse_run_report(json_str: str) -> RunReport:
    """Parse a RunReport from a JSON string."""
    data = json.loads(json_str)
    version = data.get("schema_version", "")
    if version != RUN_REPORT_SCHEMA_VERSION:
        raise ValueError(f"Unsupported RunReport schema version: {version}")

    summary = RunSummary(**_filter_dataclass_fields(RunSummary, data.get("summary", {})))
    config = RunConfig(**_filter_dataclass_fields(RunConfig, data.get("config", {})))
    results = [RunResult(**_filter_dataclass_fields(RunResult, r)) for r in data.get("results", [])]
    failures = [RunFailure(**_filter_dataclass_fields(RunFailure, f)) for f in data.get("failures", [])]

    return RunReport(
        schema_version=data["schema_version"],
        run_id=data["run_id"],
        started_at=data.get("started_at", ""),
        finished_at=data.get("finished_at", ""),
        runtime=data.get("runtime", {}),
        results=results,
        failures=failures,
        summary=summary,
        config=config,
    )
