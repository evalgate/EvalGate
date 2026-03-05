"""Evaluation Manifest Generation.

Turn discovery output into a stable, versioned, machine-consumable artifact
that becomes the input to run / impact / diff.

Port of ``cli/manifest.ts``.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from evalgate_sdk._version import SDK_VERSION

MANIFEST_SCHEMA_VERSION = 1


@dataclass
class SpecFile:
    """Spec file information."""
    file_path: str = ""
    file_hash: str = ""
    spec_count: int = 0


@dataclass
class Spec:
    """Individual specification."""
    id: str = ""
    name: str = ""
    suite_path: list[str] = field(default_factory=list)
    file_path: str = ""
    position: dict[str, int] = field(default_factory=lambda: {"line": 1, "column": 1})
    tags: list[str] = field(default_factory=list)
    depends_on: dict[str, list[str]] = field(default_factory=lambda: {
        "prompts": [], "datasets": [], "tools": [], "code": [],
    })


@dataclass
class EvaluationManifest:
    """Evaluation Manifest Schema."""
    schema_version: int = MANIFEST_SCHEMA_VERSION
    generated_at: int = 0
    project: dict[str, str] = field(default_factory=dict)
    runtime: dict[str, str] = field(default_factory=dict)
    spec_files: list[SpecFile] = field(default_factory=list)
    specs: list[Spec] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "schemaVersion": self.schema_version,
            "generatedAt": self.generated_at,
            "project": self.project,
            "runtime": self.runtime,
            "specFiles": [
            {
                "filePath": sf.file_path, 
                "fileHash": sf.file_hash, 
                "specCount": sf.spec_count
            } 
            for sf in self.spec_files
        ],
            "specs": [{
                "id": s.id, "name": s.name, "suitePath": s.suite_path,
                "filePath": s.file_path, "position": s.position,
                "tags": s.tags, "dependsOn": s.depends_on,
            } for s in self.specs],
        }


@dataclass
class ManifestLock:
    """Lock file for caching."""
    generated_at: int = 0
    file_hashes: dict[str, str] = field(default_factory=dict)


@dataclass
class SpecAnalysis:
    """Discovery result for a single spec."""
    id: str = ""
    name: str = ""
    file: str = ""
    tags: list[str] = field(default_factory=list)


def generate_manifest(
    specs: list[SpecAnalysis],
    project_root: str,
    project_name: str,
    execution_mode: Any,
) -> EvaluationManifest:
    """Generate evaluation manifest from discovery results."""
    generated_at = int(time.time())
    namespace = _generate_namespace(project_root)

    specs_by_file: dict[str, list[SpecAnalysis]] = {}
    for spec in specs:
        norm = _normalize_path(spec.file, project_root)
        specs_by_file.setdefault(norm, []).append(spec)

    spec_files: list[SpecFile] = []
    processed_specs: list[Spec] = []

    for file_path, file_specs in specs_by_file.items():
        abs_path = os.path.join(project_root, file_path)
        file_hash = _hash_file(abs_path)

        spec_files.append(SpecFile(file_path=file_path, file_hash=file_hash, spec_count=len(file_specs)))

        for sa in file_specs:
            content = _read_file_safe(abs_path)
            position = _extract_position(content, sa.name)
            depends_on = _extract_dependencies(content)
            suite_path = _generate_suite_path(sa.tags, file_path)

            processed_specs.append(Spec(
                id=sa.id, name=sa.name, suite_path=suite_path,
                file_path=_normalize_path(sa.file, project_root),
                position=position, tags=sa.tags, depends_on=depends_on,
            ))

    mode_str = getattr(execution_mode, "mode", "spec") if execution_mode else "spec"

    return EvaluationManifest(
        schema_version=MANIFEST_SCHEMA_VERSION,
        generated_at=generated_at,
        project={"name": project_name, "root": ".", "namespace": namespace},
        runtime={"mode": mode_str, "sdkVersion": SDK_VERSION},
        spec_files=spec_files,
        specs=processed_specs,
    )


def write_manifest(manifest: EvaluationManifest, project_root: str) -> None:
    """Write manifest to disk."""
    evalgate_dir = os.path.join(project_root, ".evalgate")
    os.makedirs(evalgate_dir, exist_ok=True)

    manifest_path = os.path.join(evalgate_dir, "manifest.json")
    Path(manifest_path).write_text(json.dumps(manifest.to_dict(), indent=2), encoding="utf-8")

    lock = ManifestLock(
        generated_at=manifest.generated_at,
        file_hashes={sf.file_path: sf.file_hash for sf in manifest.spec_files},
    )
    lock_path = os.path.join(evalgate_dir, "manifest.lock.json")
    Path(lock_path).write_text(json.dumps({
        "generatedAt": lock.generated_at,
        "fileHashes": lock.file_hashes,
    }, indent=2), encoding="utf-8")


def read_manifest(project_root: str) -> EvaluationManifest | None:
    """Read existing manifest."""
    manifest_path = os.path.join(project_root, ".evalgate", "manifest.json")
    try:
        data = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
        m = EvaluationManifest(
            schema_version=data.get("schemaVersion", 1),
            generated_at=data.get("generatedAt", 0),
            project=data.get("project", {}),
            runtime=data.get("runtime", {}),
        )
        for sf in data.get("specFiles", []):
            m.spec_files.append(SpecFile(
                file_path=sf["filePath"], 
                file_hash=sf["fileHash"], 
                spec_count=sf["specCount"]
            ))
        for s in data.get("specs", []):
            m.specs.append(Spec(
                id=s["id"], 
                name=s["name"], 
                suite_path=s.get("suitePath", []),
                file_path=s["filePath"], 
                position=s.get("position", {"line": 1, "column": 1}),
                tags=s.get("tags", []), 
                depends_on=s.get("dependsOn", {
                    "prompts": [], "datasets": [], "tools": [], "code": []
                }),
            ))
        return m
    except (OSError, json.JSONDecodeError, KeyError):
        return None


def read_lock(project_root: str) -> ManifestLock | None:
    """Read existing lock file."""
    lock_path = os.path.join(project_root, ".evalgate", "manifest.lock.json")
    try:
        data = json.loads(Path(lock_path).read_text(encoding="utf-8"))
        return ManifestLock(generated_at=data["generatedAt"], file_hashes=data.get("fileHashes", {}))
    except (OSError, json.JSONDecodeError, KeyError):
        return None


# ── Internal helpers ──────────────────────────────────────────────────


def _normalize_path(file_path: str, project_root: str) -> str:
    return os.path.relpath(file_path, project_root).replace("\\", "/")


def _generate_namespace(project_root: str) -> str:
    return hashlib.sha256(project_root.encode("utf-8")).hexdigest()[:8]


def _hash_file(file_path: str) -> str:
    try:
        content = Path(file_path).read_bytes()
        return f"sha256:{hashlib.sha256(content).hexdigest()}"
    except OSError:
        return "sha256:0"


def _read_file_safe(path: str) -> str:
    try:
        return Path(path).read_text(encoding="utf-8")
    except OSError:
        return ""


def _extract_position(content: str, spec_name: str) -> dict[str, int]:
    pattern = re.compile(r'define_eval\s*\(\s*["\']' + re.escape(spec_name) + r'["\']')
    for i, line_content in enumerate(content.splitlines()):
        m = pattern.search(line_content)
        if m:
            return {"line": i + 1, "column": m.start() + 1}
    return {"line": 1, "column": 1}


def _extract_dependencies(content: str) -> dict[str, list[str]]:
    deps: dict[str, list[str]] = {"prompts": [], "datasets": [], "tools": [], "code": []}

    depends_on_match = re.search(r"depends_on\s*=\s*\{([^}]+)\}", content, re.DOTALL)
    if depends_on_match:
        try:
            raw = "{" + depends_on_match.group(1) + "}"
            parsed = json.loads(raw)
            return {
                "prompts": parsed.get("prompts", []),
                "datasets": parsed.get("datasets", []),
                "tools": parsed.get("tools", []),
                "code": parsed.get("code", []),
            }
        except (json.JSONDecodeError, TypeError):
            pass

    patterns = {
        "prompts": re.compile(r'["\']([^"\']*\.md)["\']'),
        "datasets": re.compile(r'["\']([^"\']*\.json)["\']'),
        "code": re.compile(r'from\s+([^\s]+)\s+import|import\s+([^\s]+)'),
    }
    for key, pat in patterns.items():
        for m in pat.finditer(content):
            val = m.group(1) or (m.group(2) if m.lastindex and m.lastindex >= 2 else None)
            if val:
                deps[key].append(val)

    return deps


def _generate_suite_path(tags: list[str], file_path: str) -> list[str]:
    if tags:
        return [tags[0]]
    parts = file_path.split("/")
    if len(parts) > 1:
        return [parts[0]]
    return ["general"]
