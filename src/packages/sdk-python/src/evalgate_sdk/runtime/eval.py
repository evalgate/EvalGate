"""defineEval DSL — the primary API for declaring evaluation specs."""

from __future__ import annotations

import hashlib
import inspect
import re
from typing import Any, Callable

from evalgate_sdk.runtime.registry import get_active_runtime
from evalgate_sdk.runtime.types import (
    EvalResult,
    EvalSpec,
    SpecConfig,
    SpecOptions,
    SpecRegistrationError,
)

_NAME_PATTERN = re.compile(r"^[\w\-]{1,100}$")


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


class _EvalAI:
    """Convenience namespace — ``evalai.test`` is an alias for ``define_eval``."""

    test = staticmethod(define_eval)


evalai = _EvalAI()


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
) -> EvalResult:
    """Create an evaluation result."""
    return EvalResult(
        passed=passed,
        score=score,
        assertions=assertions or [],
        metadata=metadata or {},
        error=error,
        status="passed" if passed else ("error" if error else "failed"),
    )
