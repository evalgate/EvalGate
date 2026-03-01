"""Core types for the runtime foundation."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class SpecOptions:
    timeout_ms: int = 30_000
    retries: int = 0
    tags: list[str] = field(default_factory=list)
    skip: bool = False
    only: bool = False


@dataclass
class SpecConfig:
    name: str
    executor: Any = None
    options: SpecOptions = field(default_factory=SpecOptions)
    description: str | None = None
    suite: str | None = None


@dataclass
class EvalSpec:
    id: str
    name: str
    executor: Any
    options: SpecOptions = field(default_factory=SpecOptions)
    file_path: str | None = None
    suite: str | None = None
    description: str | None = None


@dataclass
class EvalContext:
    input: Any = None
    metadata: dict[str, Any] = field(default_factory=dict)
    options: dict[str, Any] = field(default_factory=dict)
    trace_id: str | None = None


@dataclass
class EvalResult:
    passed: bool
    score: float = 0.0
    assertions: list[Any] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    duration_ms: float = 0.0
    status: Literal["passed", "failed", "error", "timeout"] = "passed"


@dataclass
class ExecutorCapabilities:
    supports_async: bool = True
    supports_timeout: bool = True
    supports_retries: bool = True
    supports_parallel: bool = False


@dataclass
class ExecutionErrorEnvelope:
    error_type: str
    message: str
    stack: str | None = None
    retryable: bool = False


@dataclass
class RuntimeHealth:
    status: Literal["healthy", "degraded", "unhealthy"] = "healthy"
    spec_count: int = 0
    memory_estimate_mb: float = 0.0
    uptime_ms: float = 0.0


# ── Error classes ────────────────────────────────────────────────────


class EvalRuntimeError(Exception):
    """Base error for runtime operations."""

    pass


class SpecRegistrationError(EvalRuntimeError):
    """Raised when a spec fails to register."""

    pass


class SpecExecutionError(EvalRuntimeError):
    """Raised when a spec fails to execute."""

    pass


class RuntimeError(EvalRuntimeError):
    """Raised for general runtime errors."""

    pass


class EvalExecutionError(EvalRuntimeError):
    """Raised during eval execution with context."""

    def __init__(self, message: str, spec_id: str, cause: Exception | None = None) -> None:
        super().__init__(message)
        self.spec_id = spec_id
        self.cause = cause
