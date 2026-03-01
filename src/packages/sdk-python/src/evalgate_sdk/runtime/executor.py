"""Local executor — runs eval specs with timeout protection."""

from __future__ import annotations

import asyncio
import time

from evalgate_sdk.runtime.types import (
    EvalContext,
    EvalResult,
    EvalSpec,
    ExecutorCapabilities,
)


class LocalExecutor:
    """Execute eval specs locally with timeout and error handling."""

    def __init__(self) -> None:
        self.capabilities = ExecutorCapabilities(
            supports_async=True,
            supports_timeout=True,
            supports_retries=True,
            supports_parallel=False,
        )

    async def execute(self, spec: EvalSpec, context: EvalContext) -> EvalResult:
        timeout_s = spec.options.timeout_ms / 1000
        start = time.monotonic()

        for attempt in range(1 + spec.options.retries):
            try:
                result = spec.executor(context)
                if asyncio.iscoroutine(result) or asyncio.isfuture(result) or hasattr(result, "__await__"):
                    result = await asyncio.wait_for(result, timeout=timeout_s)

                duration = (time.monotonic() - start) * 1000

                if isinstance(result, EvalResult):
                    result.duration_ms = duration
                    return result

                if isinstance(result, dict):
                    return EvalResult(
                        passed=result.get("passed", result.get("pass", False)),
                        score=result.get("score", 1.0 if result.get("passed", result.get("pass")) else 0.0),
                        assertions=result.get("assertions", []),
                        metadata=result.get("metadata", {}),
                        error=result.get("error"),
                        duration_ms=duration,
                        status="passed" if result.get("passed", result.get("pass")) else "failed",
                    )

                passed = bool(result)
                return EvalResult(
                    passed=passed,
                    score=1.0 if passed else 0.0,
                    duration_ms=duration,
                    status="passed" if passed else "failed",
                )

            except asyncio.TimeoutError:
                duration = (time.monotonic() - start) * 1000
                if attempt < spec.options.retries:
                    continue
                return EvalResult(
                    passed=False,
                    score=0.0,
                    duration_ms=duration,
                    error=f"Timeout after {spec.options.timeout_ms}ms",
                    status="timeout",
                )
            except Exception as exc:
                duration = (time.monotonic() - start) * 1000
                if attempt < spec.options.retries:
                    continue
                return EvalResult(
                    passed=False,
                    score=0.0,
                    duration_ms=duration,
                    error=str(exc),
                    status="error",
                )

        return EvalResult(passed=False, score=0.0, error="Max retries exceeded", status="error")


def create_local_executor() -> LocalExecutor:
    return LocalExecutor()


default_local_executor = LocalExecutor()
