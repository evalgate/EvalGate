"""Context propagation using Python's contextvars — thread-safe and async-safe."""

from __future__ import annotations

import contextvars
import functools
from typing import Any, Callable, TypeVar, overload

T = TypeVar("T")
F = TypeVar("F", bound=Callable[..., Any])

ContextMetadata = dict[str, Any]

_ctx_var: contextvars.ContextVar[ContextMetadata | None] = contextvars.ContextVar("evalai_context", default=None)


class EvalContext:
    """Manages a context scope with metadata propagation."""

    def __init__(self, metadata: ContextMetadata) -> None:
        self._metadata = dict(metadata)
        self._token: contextvars.Token[ContextMetadata | None] | None = None

    @property
    def metadata(self) -> ContextMetadata:
        return dict(self._metadata)

    def enter(self) -> None:
        parent = _ctx_var.get()
        merged = {**(parent or {}), **self._metadata}
        self._token = _ctx_var.set(merged)

    def exit(self) -> None:
        if self._token is not None:
            _ctx_var.reset(self._token)
            self._token = None

    def __enter__(self) -> EvalContext:
        self.enter()
        return self

    def __exit__(self, *args: Any) -> None:
        self.exit()

    async def __aenter__(self) -> EvalContext:
        self.enter()
        return self

    async def __aexit__(self, *args: Any) -> None:
        self.exit()


def create_context(metadata: ContextMetadata) -> EvalContext:
    """Create a new context scope."""
    return EvalContext(metadata)


def get_current_context() -> ContextMetadata | None:
    """Get the current context metadata, or None if no context is active."""
    return _ctx_var.get()


def merge_with_context(metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    """Merge provided metadata with the current context."""
    current = _ctx_var.get() or {}
    return {**current, **(metadata or {})}


async def with_context(metadata: ContextMetadata, fn: Callable[[], Any]) -> Any:
    """Run *fn* inside a new context scope (async)."""
    ctx = create_context(metadata)
    async with ctx:
        result = fn()
        if hasattr(result, "__await__"):
            return await result
        return result


def with_context_sync(metadata: ContextMetadata, fn: Callable[[], T]) -> T:
    """Run *fn* inside a new context scope (sync)."""
    ctx = create_context(metadata)
    with ctx:
        return fn()


def clone_context(metadata: ContextMetadata) -> ContextMetadata:
    """Deep-copy metadata."""
    import copy

    return copy.deepcopy(metadata)


def merge_contexts(*contexts: ContextMetadata) -> ContextMetadata:
    """Merge multiple context dicts left-to-right."""
    result: ContextMetadata = {}
    for c in contexts:
        result.update(c)
    return result


def validate_context(metadata: ContextMetadata) -> None:
    """Validate context metadata — raises ValueError if invalid."""
    if not isinstance(metadata, dict):
        raise ValueError("Context metadata must be a dict")
    for key in metadata:
        if not isinstance(key, str):
            raise ValueError(f"Context keys must be strings, got {type(key)}")


class WithContext:
    """Decorator that wraps a function/method in a context scope.

    Works with both sync and async functions::

        @WithContext({"service": "MyService"})
        async def process(self, data):
            ...

        @WithContext({"component": "parser"})
        def parse(text):
            ...
    """

    def __init__(self, metadata: ContextMetadata) -> None:
        self._metadata = metadata

    @overload
    def __call__(self, fn: F) -> F: ...

    def __call__(self, fn: Callable[..., Any]) -> Callable[..., Any]:
        import asyncio

        if asyncio.iscoroutinefunction(fn):

            @functools.wraps(fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                ctx = create_context(self._metadata)
                async with ctx:
                    return await fn(*args, **kwargs)

            return async_wrapper  # type: ignore[return-value]
        else:

            @functools.wraps(fn)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                ctx = create_context(self._metadata)
                with ctx:
                    return fn(*args, **kwargs)

            return sync_wrapper  # type: ignore[return-value]
