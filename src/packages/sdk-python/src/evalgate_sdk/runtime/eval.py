"""defineEval DSL — the primary API for declaring evaluation specs."""

from __future__ import annotations

import csv
import hashlib
import inspect
import io
import json
import os
import re
from typing import Any, Callable, Literal

from evalgate_sdk.runtime.registry import get_active_runtime
from evalgate_sdk.runtime.types import (
    EvalContext,
    EvalResult,
    EvalSpec,
    SpecConfig,
    SpecOptions,
    SpecRegistrationError,
)

_NAME_PATTERN = re.compile(r"^[\w\s\-]{1,100}$")


def _generate_spec_id(name: str, file_path: str | None = None) -> str:
    """Generate a content-addressable spec ID."""
    source = name
    if file_path is None:
        frame = inspect.stack()
        for f in frame[1:]:
            if "evalgate_sdk" not in f.filename:
                file_path = f"{f.filename}:{f.lineno}"
                break
    if file_path:
        source = f"{file_path}:{name}"
    return hashlib.sha256(source.encode()).hexdigest()[:16]


def _validate_name(name: str) -> None:
    if not _NAME_PATTERN.match(name):
        raise SpecRegistrationError(
            f"Invalid spec name '{name}': must be 1-100 chars, alphanumeric/hyphens/underscores"
        )


def define_eval(
    name_or_config: Any = None,
    executor: Callable[..., Any] | None = None,
    *,
    name: str | None = None,
    options: SpecOptions | None = None,
    description: str | None = None,
    suite: str | None = None,
    tags: list[str] | None = None,
    timeout_ms: int = 30_000,
) -> EvalSpec | None:
    """Register an eval spec with the active runtime.

    Can be called as::

        # Positional style
        define_eval("my-test", my_executor)

        # Config style
        define_eval(SpecConfig(name="my-test", executor=my_executor))

        # Decorator style
        @define_eval(name="my-test")
        async def my_test(ctx):
            ...
    """
    if isinstance(name_or_config, SpecConfig):
        cfg = name_or_config
        spec_name = cfg.name
        spec_executor = cfg.executor
        spec_options = cfg.options
        spec_desc = cfg.description
        spec_suite = cfg.suite
    elif isinstance(name_or_config, str):
        spec_name = name_or_config
        spec_executor = executor
        spec_options = options or SpecOptions(timeout_ms=timeout_ms, tags=tags or [])
        spec_desc = description
        spec_suite = suite
    elif name_or_config is None and name is not None:
        spec_name = name
        spec_executor = executor
        spec_options = options or SpecOptions(timeout_ms=timeout_ms, tags=tags or [])
        spec_desc = description
        spec_suite = suite
    elif callable(name_or_config) and name is not None:
        spec_name = name
        spec_executor = name_or_config
        spec_options = options or SpecOptions(timeout_ms=timeout_ms, tags=tags or [])
        spec_desc = description
        spec_suite = suite
    else:
        # Decorator mode — return a decorator
        def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
            define_eval(
                fn,
                name=name or fn.__name__,
                options=options,
                description=description,
                suite=suite,
                tags=tags,
                timeout_ms=timeout_ms,
            )
            return fn

        if callable(name_or_config):
            return decorator(name_or_config)
        return decorator  # type: ignore[return-value]

    _validate_name(spec_name)
    spec_id = _generate_spec_id(spec_name)

    spec = EvalSpec(
        id=spec_id,
        name=spec_name,
        executor=spec_executor,
        options=spec_options,
        suite=spec_suite,
        description=spec_desc,
    )

    runtime = get_active_runtime()
    if runtime is not None:
        runtime.register(spec)

    return spec


def _define_eval_with_mode(
    mode: Literal["normal", "skip", "only"],
    name_or_config: Any = None,
    executor: Callable[..., Any] | None = None,
    *,
    name: str | None = None,
    options: SpecOptions | None = None,
    description: str | None = None,
    suite: str | None = None,
    tags: list[str] | None = None,
    timeout_ms: int = 30_000,
) -> EvalSpec | None:
    """Internal: register with a specific mode."""
    spec = define_eval(
        name_or_config,
        executor,
        name=name,
        options=options,
        description=description,
        suite=suite,
        tags=tags,
        timeout_ms=timeout_ms,
    )
    if isinstance(spec, EvalSpec):
        spec.mode = mode
    return spec


def define_eval_skip(
    name_or_config: Any = None,
    executor: Callable[..., Any] | None = None,
    **kwargs: Any,
) -> EvalSpec | None:
    """Register a spec but skip it during execution (vitest/jest ``.skip`` convention)."""
    return _define_eval_with_mode("skip", name_or_config, executor, **kwargs)


def define_eval_only(
    name_or_config: Any = None,
    executor: Callable[..., Any] | None = None,
    **kwargs: Any,
) -> EvalSpec | None:
    """Register a spec for exclusive execution (vitest/jest ``.only`` convention)."""
    return _define_eval_with_mode("only", name_or_config, executor, **kwargs)


class _EvalAI:
    """Convenience namespace — ``evalai.test`` is an alias for ``define_eval``."""

    test = staticmethod(define_eval)


evalai = _EvalAI()

# Attach .skip / .only on define_eval to match TS defineEval.skip() / defineEval.only()
define_eval.skip = define_eval_skip  # type: ignore[attr-defined]
define_eval.only = define_eval_only  # type: ignore[attr-defined]


# ── skip/only filtering ──────────────────────────────────────────────


def get_filtered_specs(specs: list[EvalSpec]) -> list[EvalSpec]:
    """Apply skip/only semantics to a list of specs.

    If any spec has ``mode == "only"``, return only those.
    Otherwise, return all specs except those with ``mode == "skip"``.
    """
    only_specs = [s for s in specs if s.mode == "only"]
    if only_specs:
        return only_specs
    return [s for s in specs if s.mode != "skip"]


# ── from_dataset ─────────────────────────────────────────────────────


def _parse_jsonl(content: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for i, line in enumerate(content.splitlines()):
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise SpecRegistrationError(f"Invalid JSON on line {i + 1} of dataset: {exc}") from exc
    return rows


def _parse_csv(content: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(content))
    return [dict(row) for row in reader]


def from_dataset(
    name: str,
    dataset_path: str,
    executor: Callable[..., Any],
    options: SpecOptions | None = None,
) -> None:
    """Load a JSONL, CSV, or JSON dataset and register one spec per row.

    Each row is passed as ``context.input`` to the executor.

    Example::

        from_dataset("rag-accuracy", "./evals/golden.jsonl", my_executor)
    """
    resolved = os.path.abspath(dataset_path)
    if not os.path.isfile(resolved):
        raise SpecRegistrationError(f"Dataset file not found: {resolved}")

    with open(resolved, encoding="utf-8") as f:
        content = f.read()

    ext = os.path.splitext(resolved)[1].lower()
    if ext in (".jsonl", ".ndjson"):
        rows = _parse_jsonl(content)
    elif ext == ".csv":
        rows = _parse_csv(content)
    elif ext == ".json":
        parsed = json.loads(content)
        rows = parsed if isinstance(parsed, list) else [parsed]
    else:
        raise SpecRegistrationError(f"Unsupported dataset format: {ext}. Use .jsonl, .ndjson, .csv, or .json")

    if not rows:
        raise SpecRegistrationError(f"Dataset is empty: {resolved}")

    for i, row in enumerate(rows):
        row_name = f"{name} - row {i + 1}"

        def _make_wrapper(r: dict[str, Any]) -> Callable[..., Any]:
            async def wrapper(ctx: EvalContext) -> EvalResult:
                ctx.input = r
                return await executor(ctx)
            return wrapper

        row_options = SpecOptions(
            timeout_ms=options.timeout_ms if options else 30_000,
            tags=list(options.tags) if options and options.tags else [],
            metadata={
                **(options.metadata or {} if options else {}),
                "dataset_path": resolved,
                "dataset_row": i + 1,
            },
        )
        define_eval(row_name, _make_wrapper(row), options=row_options)


def define_suite(name: str, specs: list[Callable[[], None]]) -> None:
    """Group multiple define_eval calls into a named suite."""
    for spec_fn in specs:
        spec_fn()


def create_result(
    *,
    passed: bool,
    score: float = 0.0,
    assertions: list[Any] | None = None,
    metadata: dict[str, Any] | None = None,
    error: str | None = None,
    output: str | None = None,
    tokens: int | None = None,
    duration_ms: float | None = None,
) -> EvalResult:
    """Create an evaluation result."""
    clamped_score = max(0.0, min(100.0, score))
    return EvalResult(
        passed=passed,
        score=clamped_score,
        assertions=assertions or [],
        metadata=metadata or {},
        error=error,
        status="passed" if passed else ("error" if error else "failed"),
        output=output,
        tokens=tokens,
        duration_ms=duration_ms or 0.0,
    )
