"""Config → DSL Adapter — LAYER 2 Compatibility Bridge.

Migrates existing evalgate.config.json and TestSuite configurations
to the new define_eval() DSL without breaking user workflows.

Port of ``runtime/adapters/config-to-dsl.ts``.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class MigrationResult:
    """Migration result information."""
    success: bool = True
    specs_generated: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    output_path: str = ""


@dataclass
class EvalAIConfig:
    """Configuration file structure (existing evalgate.config.json)."""
    evaluation_id: str | None = None
    gate: dict[str, str] | None = None
    packages: dict[str, Any] | None = None
    extra: dict[str, Any] = field(default_factory=dict)


def migrate_config_to_dsl(
    config_path: str,
    output_path: str,
) -> MigrationResult:
    """Convert evalgate.config.json to DSL specifications."""
    result = MigrationResult(output_path=output_path)

    if not os.path.exists(config_path):
        result.success = False
        result.errors.append(f"Configuration file not found: {config_path}")
        return result

    try:
        with open(config_path, encoding="utf-8") as f:
            config_data = json.load(f)

        config = EvalAIConfig(
            evaluation_id=config_data.get("evaluationId"),
            gate=config_data.get("gate"),
            packages=config_data.get("packages"),
        )

        dsl_content = _generate_dsl_from_config(config)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(output_path).write_text(dsl_content, encoding="utf-8")

        result.specs_generated = 1
        result.warnings.append(
            "Generated basic DSL structure from evalgate.config.json. Manual completion required."
        )
    except Exception as exc:
        result.success = False
        result.errors.append(f"Config migration failed: {exc}")

    return result


def migrate_testsuite_to_dsl(
    suite_data: dict[str, Any],
    output_path: str,
) -> MigrationResult:
    """Convert TestSuite data to defineEval() DSL specifications."""
    result = MigrationResult(output_path=output_path)

    try:
        name = suite_data.get("name", "test-suite")
        cases = suite_data.get("cases", [])

        dsl_content = _generate_dsl_from_suite(name, cases)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(output_path).write_text(dsl_content, encoding="utf-8")

        result.specs_generated = len(cases)
        result.warnings.append(
            f"Migrated {len(cases)} test cases from TestSuite to define_eval() DSL"
        )
    except Exception as exc:
        result.success = False
        result.errors.append(f"Migration failed: {exc}")

    return result


def migrate_project_to_dsl(
    project_root: str,
    output_dir: str | None = None,
    dry_run: bool = False,
) -> MigrationResult:
    """Discover and migrate all configurations in a project."""
    out_dir = output_dir or os.path.join(project_root, ".evalgate", "migrated")
    result = MigrationResult(output_path=out_dir)

    try:
        # Find config files
        config_names = [
            "evalgate.config.json",
            "evalai.config.json",
        ]
        config_path: str | None = None
        for name in config_names:
            candidate = os.path.join(project_root, name)
            if os.path.exists(candidate):
                config_path = candidate
                break

        if config_path:
            output_path = os.path.join(out_dir, "evalgate.config.migrated.py")
            if not dry_run:
                sub = migrate_config_to_dsl(config_path, output_path)
                result.specs_generated += sub.specs_generated
                result.errors.extend(sub.errors)
                result.warnings.extend(sub.warnings)
            else:
                result.warnings.append(f"Would migrate {config_path} to {output_path}")

        # Find TestSuite usage in Python files
        test_files = _find_testsuite_files(project_root)
        for test_file in test_files:
            output_path = os.path.join(
                out_dir,
                Path(test_file).stem + ".migrated.py",
            )
            if not dry_run:
                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
                content = _generate_placeholder_dsl(test_file)
                Path(output_path).write_text(content, encoding="utf-8")
                result.specs_generated += 1
                result.warnings.append(f"Created migration placeholder for {test_file}")
            else:
                result.warnings.append(f"Would migrate {test_file} to {output_path}")

        if result.specs_generated == 0:
            result.warnings.append("No TestSuite configurations found to migrate")
    except Exception as exc:
        result.success = False
        result.errors.append(f"Project migration failed: {exc}")

    return result


def _find_testsuite_files(project_root: str) -> list[str]:
    """Find files that might contain TestSuite usage."""
    found: list[str] = []
    for root, dirs, files in os.walk(project_root):
        # Skip hidden dirs and common non-source dirs
        dirs[:] = [
            d for d in dirs 
            if not d.startswith(".") and d not in (
                "node_modules", "__pycache__", ".git", "venv"
            )
        ]
        for fname in files:
            if not fname.endswith(".py"):
                continue
            full = os.path.join(root, fname)
            try:
                text = Path(full).read_text(encoding="utf-8", errors="ignore")
                if "create_test_suite" in text or "TestSuite" in text:
                    found.append(full)
            except OSError:
                pass
    return found


def _generate_dsl_from_config(config: EvalAIConfig) -> str:
    """Generate DSL code from configuration."""
    now = datetime.now(timezone.utc).isoformat()
    eval_id = json.dumps(config.evaluation_id) if config.evaluation_id else "None"
    return f'''# Auto-generated from evalgate.config.json
# Generated at: {now}
# This is a basic DSL structure — complete with your actual evaluations

from evalgate_sdk import define_eval, create_result


define_eval("basic-evaluation", _basic_eval)


async def _basic_eval(ctx):
    input_text = ctx.input

    # TODO: Replace with your actual agent/LLM call
    output = f"Agent response to: {{input_text}}"

    passed = len(output) > 0
    score = 100 if passed else 0

    return create_result(
        passed=passed,
        score=score,
        output=output,
        metadata={{
            "evaluation_id": {eval_id},
            "input": input_text,
        }},
    )
'''


def _generate_dsl_from_suite(name: str, cases: list[dict[str, Any]]) -> str:
    """Generate DSL code from TestSuite data."""
    now = datetime.now(timezone.utc).isoformat()
    lines = [
        f"# Auto-generated from TestSuite: {name}",
        f"# Generated at: {now}",
        "# This file replaces the old TestSuite configuration",
        "",
        "from evalgate_sdk import define_eval, create_result",
        "",
    ]

    for i, case in enumerate(cases):
        case_id = case.get("id", f"{name}-case-{i + 1}")
        case_input = json.dumps(case.get("input", ""))
        case_expected = json.dumps(case.get("expected"))
        lines.extend([
            f'define_eval("{case_id}", lambda ctx: _eval_{i}(ctx))',
            "",
            f"async def _eval_{i}(ctx):",
            f"    # Original input: {case_input}",
            f"    # Original expected: {case_expected}",
            "    input_text = ctx.input",
            "    # TODO: Replace with your actual agent/LLM call",
            '    output = f"Agent response to: {input_text}"',
            "    passed = len(output) > 0",
            "    return create_result(passed=passed, score=100 if passed else 0, output=output)",
            "",
        ])

    return "\n".join(lines)


def _generate_placeholder_dsl(original_file: str) -> str:
    """Generate placeholder DSL for files that need manual migration."""
    now = datetime.now(timezone.utc).isoformat()
    basename = Path(original_file).stem
    return f'''# Migration placeholder for: {original_file}
# Generated at: {now}
# This file contains TestSuite usage that needs manual migration

from evalgate_sdk import define_eval, create_result


define_eval("placeholder-from-{basename}", _placeholder_eval)


async def _placeholder_eval(ctx):
    # TODO: Manually migrate TestSuite from {original_file}
    input_text = ctx.input
    output = f"Response to: {{input_text}}"
    return create_result(
        passed=len(output) > 0,
        score=100 if len(output) > 0 else 0,
        metadata={{"migrated_from": {json.dumps(original_file)}}},
    )
'''
