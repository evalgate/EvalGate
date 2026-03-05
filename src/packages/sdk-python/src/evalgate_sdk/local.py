"""Local storage for offline development mode (T7).

Port of the TypeScript SDK's ``local.ts``.
Provides filesystem-based storage for traces, evaluations, and spans.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class LocalStorageStats:
    traces: int = 0
    evaluations: int = 0
    spans: int = 0
    total_size_bytes: int = 0


class LocalStorage:
    """Filesystem-based offline storage for development.

    Usage::

        storage = LocalStorage(".evalgate-data")
        storage.save_trace("t-1", {"name": "chat", "spans": [...]})
        trace = storage.get_trace("t-1")
        all_traces = storage.list_traces()
        storage.export_json("export.json")
    """

    def __init__(self, directory: str = ".evalgate-data", *, auto_save: bool = True) -> None:
        self._dir = Path(directory)
        self._auto_save = auto_save
        self._traces_dir = self._dir / "traces"
        self._evals_dir = self._dir / "evaluations"
        self._spans_dir = self._dir / "spans"
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        for d in (self._traces_dir, self._evals_dir, self._spans_dir):
            d.mkdir(parents=True, exist_ok=True)

    # ── Traces ────────────────────────────────────────────────────────

    def save_trace(self, trace_id: str, data: dict[str, Any]) -> None:
        """Save a trace to local storage."""
        record = {**data, "saved_at": data.get("saved_at", time.time())}
        self._write(self._traces_dir / f"{trace_id}.json", record)

    def get_trace(self, trace_id: str) -> dict[str, Any] | None:
        """Retrieve a trace by ID."""
        return self._read(self._traces_dir / f"{trace_id}.json")

    def list_traces(self) -> list[str]:
        """List all trace IDs."""
        return self._list_ids(self._traces_dir)

    # ── Evaluations ───────────────────────────────────────────────────

    def save_evaluation(self, eval_id: str, data: dict[str, Any]) -> None:
        """Save an evaluation to local storage."""
        record = {**data, "saved_at": data.get("saved_at", time.time())}
        self._write(self._evals_dir / f"{eval_id}.json", record)

    def get_evaluation(self, eval_id: str) -> dict[str, Any] | None:
        """Retrieve an evaluation by ID."""
        return self._read(self._evals_dir / f"{eval_id}.json")

    def list_evaluations(self) -> list[str]:
        """List all evaluation IDs."""
        return self._list_ids(self._evals_dir)

    # ── Spans ─────────────────────────────────────────────────────────

    def save_spans(self, trace_id: str, spans: list[dict[str, Any]]) -> None:
        """Save spans for a trace."""
        self._write(self._spans_dir / f"{trace_id}.json", {"spans": spans, "saved_at": time.time()})

    def get_spans(self, trace_id: str) -> list[dict[str, Any]]:
        """Retrieve spans for a trace."""
        data = self._read(self._spans_dir / f"{trace_id}.json")
        return data.get("spans", []) if data else []

    # ── Utilities ─────────────────────────────────────────────────────

    def clear(self) -> None:
        """Remove all stored data."""
        import shutil

        for d in (self._traces_dir, self._evals_dir, self._spans_dir):
            if d.exists():
                shutil.rmtree(d)
        self._ensure_dirs()

    def export_json(self, output_path: str) -> None:
        """Export all data to a single JSON file."""
        data = {
            "exported_at": time.time(),
            "traces": {},
            "evaluations": {},
            "spans": {},
        }
        for tid in self.list_traces():
            data["traces"][tid] = self.get_trace(tid)
        for eid in self.list_evaluations():
            data["evaluations"][eid] = self.get_evaluation(eid)
        for tid in self.list_traces():
            spans = self.get_spans(tid)
            if spans:
                data["spans"][tid] = spans

        Path(output_path).write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")

    def get_stats(self) -> LocalStorageStats:
        """Get storage statistics."""
        stats = LocalStorageStats()
        stats.traces = len(self.list_traces())
        stats.evaluations = len(self.list_evaluations())
        stats.spans = len(list(self._spans_dir.glob("*.json")))
        stats.total_size_bytes = sum(
            f.stat().st_size
            for d in (self._traces_dir, self._evals_dir, self._spans_dir)
            for f in d.glob("*.json")
        )
        return stats

    # ── Internal ──────────────────────────────────────────────────────

    @staticmethod
    def _write(path: Path, data: dict[str, Any]) -> None:
        path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")

    @staticmethod
    def _read(path: Path) -> dict[str, Any] | None:
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _list_ids(directory: Path) -> list[str]:
        return sorted(f.stem for f in directory.glob("*.json"))
