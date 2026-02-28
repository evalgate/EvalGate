"""Data export and import — JSON, CSV, JSONL formats with LangSmith conversion."""

from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

ExportFormat = Literal["json", "csv", "jsonl"]


@dataclass
class ExportOptions:
    format: ExportFormat = "json"
    include_traces: bool = True
    include_evaluations: bool = True
    include_test_cases: bool = True
    include_runs: bool = True
    start_date: str | None = None
    end_date: str | None = None
    organization_id: int | None = None


@dataclass
class ImportOptions:
    skip_duplicates: bool = True
    dry_run: bool = False
    organization_id: int | None = None


@dataclass
class ExportData:
    format: ExportFormat = "json"
    traces: list[dict[str, Any]] = field(default_factory=list)
    evaluations: list[dict[str, Any]] = field(default_factory=list)
    test_cases: list[dict[str, Any]] = field(default_factory=list)
    runs: list[dict[str, Any]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ImportResult:
    imported: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)
    dry_run: bool = False


async def export_data(client: Any, options: ExportOptions | None = None) -> ExportData:
    """Export traces, evaluations, test cases, and runs from the platform."""
    opts = options or ExportOptions()
    data = ExportData(format=opts.format)

    if opts.include_traces:
        from evalai_sdk.types import ListTracesParams

        params = ListTracesParams(limit=100)
        if opts.organization_id:
            params.organization_id = opts.organization_id
        traces = await client.traces.list(params)
        data.traces = [t.model_dump(mode="json") for t in traces]

    if opts.include_evaluations:
        evals = await client.evaluations.list()
        data.evaluations = [e.model_dump(mode="json") for e in evals]

        if opts.include_test_cases:
            for ev in evals:
                tcs = await client.evaluations.list_test_cases(ev.id)
                data.test_cases.extend(tc.model_dump(mode="json") for tc in tcs)

        if opts.include_runs:
            for ev in evals:
                runs = await client.evaluations.list_runs(ev.id)
                data.runs.extend(r.model_dump(mode="json") for r in runs)

    data.metadata = {"exported_at": _now_iso(), "total_items": len(data.traces) + len(data.evaluations)}
    return data


async def import_data(client: Any, data: ExportData, options: ImportOptions | None = None) -> ImportResult:
    """Import data back into the platform."""
    opts = options or ImportOptions()
    result = ImportResult(dry_run=opts.dry_run)

    if opts.dry_run:
        result.imported = len(data.traces) + len(data.evaluations)
        return result

    from evalai_sdk.types import CreateEvaluationParams, CreateTraceParams

    for trace_data in data.traces:
        try:
            await client.traces.create(
                CreateTraceParams(
                    name=trace_data.get("name", "imported"),
                    metadata=trace_data.get("metadata"),
                )
            )
            result.imported += 1
        except Exception as exc:
            if opts.skip_duplicates and "duplicate" in str(exc).lower():
                result.skipped += 1
            else:
                result.errors.append(str(exc))

    for eval_data in data.evaluations:
        try:
            await client.evaluations.create(
                CreateEvaluationParams(
                    name=eval_data.get("name", "imported"),
                    description=eval_data.get("description"),
                )
            )
            result.imported += 1
        except Exception as exc:
            if opts.skip_duplicates and "duplicate" in str(exc).lower():
                result.skipped += 1
            else:
                result.errors.append(str(exc))

    return result


def export_to_file(data: ExportData, file_path: str) -> None:
    """Write export data to a file in the specified format."""
    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    if data.format == "json":
        path.write_text(
            json.dumps(
                {
                    "traces": data.traces,
                    "evaluations": data.evaluations,
                    "test_cases": data.test_cases,
                    "runs": data.runs,
                    "metadata": data.metadata,
                },
                indent=2,
                default=str,
            ),
            encoding="utf-8",
        )

    elif data.format == "jsonl":
        lines: list[str] = []
        for t in data.traces:
            lines.append(json.dumps({"type": "trace", **t}, default=str))
        for e in data.evaluations:
            lines.append(json.dumps({"type": "evaluation", **e}, default=str))
        path.write_text("\n".join(lines), encoding="utf-8")

    elif data.format == "csv":
        path.write_text(convert_to_csv(data, "traces"), encoding="utf-8")


def import_from_file(file_path: str) -> ExportData:
    """Read export data from a file."""
    path = Path(file_path)
    text = path.read_text(encoding="utf-8")

    if file_path.endswith(".jsonl"):
        data = ExportData(format="jsonl")
        for line in text.strip().splitlines():
            obj = json.loads(line)
            record_type = obj.pop("type", "trace")
            if record_type == "trace":
                data.traces.append(obj)
            elif record_type == "evaluation":
                data.evaluations.append(obj)
        return data
    else:
        raw = json.loads(text)
        return ExportData(
            format="json",
            traces=raw.get("traces", []),
            evaluations=raw.get("evaluations", []),
            test_cases=raw.get("test_cases", []),
            runs=raw.get("runs", []),
            metadata=raw.get("metadata", {}),
        )


def convert_to_csv(data: ExportData, resource_type: Literal["traces", "evaluations"] = "traces") -> str:
    """Convert export data to CSV string."""
    items = data.traces if resource_type == "traces" else data.evaluations
    if not items:
        return ""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=sorted(items[0].keys()))
    writer.writeheader()
    for item in items:
        writer.writerow({k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in item.items()})
    return buf.getvalue()


def import_from_langsmith(langsmith_data: Any) -> ExportData:
    """Convert LangSmith export format to EvalAI format."""
    data = ExportData()
    if isinstance(langsmith_data, list):
        for item in langsmith_data:
            data.traces.append(
                {
                    "name": item.get("name", item.get("run_type", "langsmith-import")),
                    "input": json.dumps(item.get("inputs", {})),
                    "output": json.dumps(item.get("outputs", {})),
                    "metadata": {
                        "langsmith_id": item.get("id"),
                        "run_type": item.get("run_type"),
                        "source": "langsmith",
                    },
                }
            )
    return data


def _now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
