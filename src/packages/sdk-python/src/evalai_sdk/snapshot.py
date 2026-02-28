"""Snapshot testing — save, load, compare LLM outputs against golden snapshots."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path


@dataclass
class SnapshotMetadata:
    name: str
    created_at: str
    content_hash: str
    version: int = 1


@dataclass
class SnapshotData:
    name: str
    output: str
    metadata: SnapshotMetadata
    tags: list[str] = field(default_factory=list)


@dataclass
class SnapshotComparison:
    name: str
    matches: bool
    similarity: float
    current_output: str
    snapshot_output: str
    diff_lines: list[str] = field(default_factory=list)


_DEFAULT_DIR = ".snapshots"


def _safe_name(name: str) -> str:
    """Sanitize snapshot name for filesystem use."""
    safe = re.sub(r"[^\w\-.]", "_", name)
    if ".." in safe or safe.startswith("/") or safe.startswith("\\"):
        raise ValueError(f"Invalid snapshot name: {name}")
    return safe


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _similarity(a: str, b: str) -> float:
    """Line-by-line similarity ratio."""
    lines_a = a.splitlines()
    lines_b = b.splitlines()
    if not lines_a and not lines_b:
        return 1.0
    total = max(len(lines_a), len(lines_b))
    matches = sum(1 for la, lb in zip(lines_a, lines_b) if la == lb)
    return matches / total if total > 0 else 1.0


class SnapshotManager:
    """Manage snapshot files on disk.

    Usage::

        mgr = SnapshotManager()
        snap = mgr.save("my-test", "Hello world output")
        comparison = mgr.compare("my-test", "Hello world output v2")
    """

    def __init__(self, directory: str = _DEFAULT_DIR) -> None:
        self._dir = Path(directory)

    def _path(self, name: str) -> Path:
        return self._dir / f"{_safe_name(name)}.json"

    def save(self, name: str, output: str, tags: list[str] | None = None) -> SnapshotData:
        """Save a snapshot to disk."""
        self._dir.mkdir(parents=True, exist_ok=True)
        snap = SnapshotData(
            name=name,
            output=output,
            metadata=SnapshotMetadata(
                name=name,
                created_at=datetime.now(timezone.utc).isoformat(),
                content_hash=_content_hash(output),
            ),
            tags=tags or [],
        )
        path = self._path(name)
        path.write_text(
            json.dumps(
                {
                    "name": snap.name,
                    "output": snap.output,
                    "metadata": {
                        "name": snap.metadata.name,
                        "created_at": snap.metadata.created_at,
                        "content_hash": snap.metadata.content_hash,
                        "version": snap.metadata.version,
                    },
                    "tags": snap.tags,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        return snap

    def load(self, name: str) -> SnapshotData | None:
        """Load a snapshot from disk."""
        path = self._path(name)
        if not path.exists():
            return None
        raw = json.loads(path.read_text(encoding="utf-8"))
        return SnapshotData(
            name=raw["name"],
            output=raw["output"],
            metadata=SnapshotMetadata(**raw["metadata"]),
            tags=raw.get("tags", []),
        )

    def compare(self, name: str, current_output: str) -> SnapshotComparison:
        """Compare current output against a saved snapshot."""
        existing = self.load(name)
        if existing is None:
            self.save(name, current_output)
            return SnapshotComparison(
                name=name,
                matches=True,
                similarity=1.0,
                current_output=current_output,
                snapshot_output=current_output,
            )

        matches = existing.output == current_output
        sim = _similarity(existing.output, current_output)

        diff: list[str] = []
        old_lines = existing.output.splitlines()
        new_lines = current_output.splitlines()
        for i in range(max(len(old_lines), len(new_lines))):
            old = old_lines[i] if i < len(old_lines) else ""
            new = new_lines[i] if i < len(new_lines) else ""
            if old != new:
                diff.append(f"L{i + 1}: -{old!r} +{new!r}")

        return SnapshotComparison(
            name=name,
            matches=matches,
            similarity=sim,
            current_output=current_output,
            snapshot_output=existing.output,
            diff_lines=diff,
        )

    def delete(self, name: str) -> bool:
        path = self._path(name)
        if path.exists():
            path.unlink()
            return True
        return False

    def list_snapshots(self) -> list[SnapshotData]:
        if not self._dir.exists():
            return []
        results: list[SnapshotData] = []
        for p in sorted(self._dir.glob("*.json")):
            try:
                raw = json.loads(p.read_text(encoding="utf-8"))
                results.append(
                    SnapshotData(
                        name=raw["name"],
                        output=raw["output"],
                        metadata=SnapshotMetadata(**raw["metadata"]),
                        tags=raw.get("tags", []),
                    )
                )
            except (json.JSONDecodeError, KeyError):
                continue
        return results


# Module-level convenience functions using a default manager

_default_manager: SnapshotManager | None = None


def _get_manager(directory: str | None = None) -> SnapshotManager:
    global _default_manager
    if directory is not None:
        return SnapshotManager(directory)
    if _default_manager is None:
        _default_manager = SnapshotManager()
    return _default_manager


def snapshot(output: str, name: str, *, directory: str | None = None, tags: list[str] | None = None) -> SnapshotData:
    return _get_manager(directory).save(name, output, tags)


def load_snapshot(name: str, *, directory: str | None = None) -> SnapshotData | None:
    return _get_manager(directory).load(name)


def compare_with_snapshot(name: str, current_output: str, *, directory: str | None = None) -> SnapshotComparison:
    return _get_manager(directory).compare(name, current_output)


def delete_snapshot(name: str, *, directory: str | None = None) -> bool:
    return _get_manager(directory).delete(name)


def list_snapshots(*, directory: str | None = None) -> list[SnapshotData]:
    return _get_manager(directory).list_snapshots()
