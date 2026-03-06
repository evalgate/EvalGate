"""Runtime registry — manages eval spec lifecycle and lookup."""

from __future__ import annotations

import builtins
import hashlib
import time
from collections.abc import Callable
from typing import Any, TypeVar

from evalgate_sdk.runtime.types import (
    EvalSpec,
    RuntimeHealth,
    SpecRegistrationError,
)

T = TypeVar("T")


class EvalRuntime:
    """In-process registry for eval specs."""

    def __init__(self, namespace: str = "default") -> None:
        self._namespace = namespace
        self._specs: dict[str, EvalSpec] = {}
        self._started_at = time.monotonic()

    @property
    def namespace(self) -> str:
        return self._namespace

    def register(self, spec: EvalSpec) -> None:
        if spec.id in self._specs:
            raise SpecRegistrationError(f"Spec '{spec.id}' already registered")
        self._specs[spec.id] = spec

    def get(self, spec_id: str) -> EvalSpec | None:
        return self._specs.get(spec_id)

    def list(self, *, suite: str | None = None, tags: builtins.list[str] | None = None) -> builtins.list[EvalSpec]:
        specs = list(self._specs.values())
        if suite is not None:
            specs = [s for s in specs if s.suite == suite]
        if tags:
            tag_set = set(tags)
            specs = [s for s in specs if tag_set.issubset(set(s.options.tags))]
        return specs

    def find(self, pattern: str) -> builtins.list[EvalSpec]:
        return [s for s in self._specs.values() if pattern in s.name or pattern in s.id]

    def clear(self) -> None:
        self._specs.clear()

    def get_health(self) -> RuntimeHealth:
        return RuntimeHealth(
            status="healthy",
            spec_count=len(self._specs),
            memory_estimate_mb=len(self._specs) * 0.001,
            uptime_ms=(time.monotonic() - self._started_at) * 1000,
        )


class RuntimeHandle:
    """Scoped runtime with lifecycle management."""

    def __init__(self, runtime: EvalRuntime) -> None:
        self.runtime = runtime

    def define_eval(self, spec: EvalSpec) -> None:
        self.runtime.register(spec)

    def dispose(self) -> None:
        self.runtime.clear()

    def snapshot(self) -> dict[str, Any]:
        return {
            "namespace": self.runtime.namespace,
            "specs": [
                {"id": s.id, "name": s.name, "suite": s.suite, "tags": s.options.tags} for s in self.runtime.list()
            ],
        }

    def load(self, data: dict[str, Any]) -> None:
        pass


_active_runtime: EvalRuntime | None = None


def create_eval_runtime(project_root: str | None = None) -> RuntimeHandle:
    namespace = "default"
    if project_root:
        namespace = hashlib.sha256(project_root.encode()).hexdigest()[:12]
    runtime = EvalRuntime(namespace=namespace)
    global _active_runtime
    _active_runtime = runtime
    return RuntimeHandle(runtime)


def get_active_runtime() -> EvalRuntime | None:
    return _active_runtime


def set_active_runtime(runtime: EvalRuntime) -> None:
    global _active_runtime
    _active_runtime = runtime


def dispose_active_runtime() -> None:
    global _active_runtime
    if _active_runtime:
        _active_runtime.clear()
        _active_runtime = None


async def with_runtime(project_root: str, fn: Callable[[RuntimeHandle], Any]) -> Any:
    handle = create_eval_runtime(project_root)
    try:
        result = fn(handle)
        if hasattr(result, "__await__"):
            return await result
        return result
    finally:
        handle.dispose()
