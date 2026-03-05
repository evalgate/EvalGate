"""COMPAT-202: Legacy TestSuite → define_eval adapter.

Converts legacy TestSuite instances to define_eval specifications
without forcing migration. Enables lossless where possible.

Port of ``runtime/adapters/testsuite-to-dsl.ts``.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

from evalgate_sdk.runtime.eval import create_result


@dataclass
class TestSuiteAdapterOptions:
    """Adapter configuration options."""
    include_provenance: bool = True
    preserve_ids: bool = True
    generate_helpers: bool = True


@dataclass
class TestDefinition:
    """A single test definition from a legacy TestSuite."""
    id: str = ""
    input: str = ""
    expected: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    assertions: list[Any] = field(default_factory=list)

    @property
    def has_assertions(self) -> bool:
        return len(self.assertions) > 0

    @property
    def assertion_count(self) -> int:
        return len(self.assertions)


@dataclass
class AdaptedSpec:
    """An adapted EvalSpec from a legacy TestSuite."""
    id: str = ""
    name: str = ""
    file_path: str = "legacy://testsuite"
    position: dict[str, int] = field(default_factory=lambda: {"line": 1, "column": 1})
    description: str = ""
    tags: list[str] = field(default_factory=lambda: ["legacy", "migrated"])
    metadata: dict[str, Any] = field(default_factory=dict)
    config: dict[str, Any] = field(default_factory=dict)
    executor: Callable[..., Any] | None = None


def adapt_test_suite(
    tests: list[TestDefinition],
    suite_name: str = "legacy-suite",
    options: TestSuiteAdapterOptions | None = None,
) -> list[AdaptedSpec]:
    """Convert TestSuite test definitions to adapted EvalSpec list.

    Parameters
    ----------
    tests:
        List of test definitions extracted from a TestSuite.
    suite_name:
        Name of the original suite.
    options:
        Adapter configuration.
    """
    opts = options or TestSuiteAdapterOptions()
    specs: list[AdaptedSpec] = []

    for test in tests:
        spec_id = _generate_spec_id(test, suite_name, opts.preserve_ids)

        metadata: dict[str, Any] = dict(test.metadata)
        if opts.include_provenance:
            metadata.update({
                "source": "legacy",
                "legacy_suite_name": suite_name,
                "legacy_test_id": test.id,
                "original_input": test.input,
                "original_expected": test.expected,
            })

        executor = _create_executor_from_test(test, opts.generate_helpers)

        spec = AdaptedSpec(
            id=spec_id,
            name=test.id,
            description=f"Legacy test: {test.id}",
            tags=["legacy", "migrated"],
            metadata=metadata,
            executor=executor,
        )
        specs.append(spec)

    return specs


def generate_define_eval_code(
    tests: list[TestDefinition],
    suite_name: str = "legacy-suite",
    options: TestSuiteAdapterOptions | None = None,
) -> str:
    """Generate define_eval() Python code from TestSuite data.

    Returns generated Python source code as a string.
    """
    specs = adapt_test_suite(tests, suite_name, options)
    now = datetime.now(timezone.utc).isoformat()

    lines = [
        f"# Auto-generated from TestSuite: {suite_name}",
        f"# Generated at: {now}",
        "# This file replaces the legacy TestSuite with define_eval() specifications",
        "",
        "from evalgate_sdk import define_eval, create_result",
        "",
    ]

    for i, spec in enumerate(specs):
        original_input = repr(spec.metadata.get("original_input", ""))
        original_expected = repr(spec.metadata.get("original_expected"))

        lines.extend([
            f'define_eval("{spec.name}", _eval_{i}, options={{'
            f'"description": "{spec.description}", "tags": {spec.tags!r}}})',
            "",
            f"async def _eval_{i}(ctx):",
            f"    # Original input: {original_input}",
            f"    # Original expected: {original_expected}",
            "    input_text = ctx.input",
            "",
            "    # TODO: Replace with your actual agent/LLM call",
            '    output = f"Response to: {input_text}"',
            "",
            "    # Legacy evaluation logic",
            f"    expected = {original_expected}",
            "    if expected is not None:",
            "        passed = output == expected",
            "    else:",
            "        passed = len(output) > 0",
            "    return create_result(passed=passed, score=100 if passed else 0, output=output)",
            "",
        ])

    return "\n".join(lines)


def _generate_spec_id(
    test: TestDefinition,
    suite_name: str,
    preserve_ids: bool,
) -> str:
    """Generate specification ID for legacy test."""
    import re

    if preserve_ids and test.id and not test.id.startswith("case-"):
        cleaned = re.sub(r"[^a-zA-Z0-9_-]", "_", test.id)[:20]
        return cleaned

    content = f"{suite_name}|{test.id}|{test.input}|{test.expected or ''}"
    raw = base64.b64encode(content.encode("utf-8")).decode("ascii")
    cleaned = raw.replace("+", "").replace("/", "").replace("=", "")[:20].lower()
    return cleaned


def _create_executor_from_test(
    test: TestDefinition,
    generate_helpers: bool,
) -> Callable[..., Any]:
    """Create executor function from test case."""

    async def executor(ctx: Any) -> Any:
        input_text = getattr(ctx, "input", str(ctx))

        if test.expected is not None:
            # In a real migration the caller replaces this with their agent call.
            # The default stub echoes input so the comparison is meaningful.
            output = input_text
            exact_match = output == test.expected
            return create_result(
                passed=exact_match,
                score=100 if exact_match else 0,
                output=output,
                metadata={
                    "test_case_id": test.id,
                    "original_input": test.input,
                    "original_expected": test.expected,
                },
            )

        return create_result(
            passed=False,
            score=0,
            error="No executor or expected output available for legacy test",
        )

    return executor
