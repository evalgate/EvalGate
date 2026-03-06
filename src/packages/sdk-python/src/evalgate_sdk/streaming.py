"""Streaming evaluation, batch reading, and rate-limiting utilities."""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator, Callable, Coroutine
from dataclasses import dataclass, field
from typing import Any, Generic, TypeVar

T = TypeVar("T")
R = TypeVar("R")


@dataclass
class BatchProgress:
    completed: int = 0
    total: int = 0
    failed: int = 0
    elapsed_ms: float = 0


@dataclass
class BatchResult(Generic[R]):
    results: list[R] = field(default_factory=list)
    errors: list[dict[str, Any]] = field(default_factory=list)
    total: int = 0
    succeeded: int = 0
    failed: int = 0
    duration_ms: float = 0


class RateLimiter:
    """Token-bucket rate limiter.

    Usage::

        limiter = RateLimiter(requests_per_second=10)
        result = await limiter.throttle(my_async_fn)
    """

    def __init__(self, requests_per_second: float = 10) -> None:
        self._interval = 1.0 / requests_per_second
        self._last_call = 0.0
        self._lock = asyncio.Lock()

    async def throttle(self, fn: Callable[[], Coroutine[Any, Any, T]]) -> T:
        async with self._lock:
            now = time.monotonic()
            wait = self._interval - (now - self._last_call)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_call = time.monotonic()
        return await fn()


def chunk(items: list[T], size: int) -> list[list[T]]:
    """Split a list into chunks of *size*."""
    return [items[i : i + size] for i in range(0, len(items), size)]


async def stream_evaluation(
    evaluator: Callable[[str], Coroutine[Any, Any, str]],
    inputs: list[str],
    *,
    concurrency: int = 3,
    on_progress: Callable[[BatchProgress], None] | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Stream evaluation results as they complete.

    Yields dicts with ``input``, ``output``, ``index``, ``duration_ms``, and optionally ``error``.
    """
    semaphore = asyncio.Semaphore(concurrency)
    progress = BatchProgress(total=len(inputs))
    start = time.monotonic()

    async def _run(index: int, input_text: str) -> dict[str, Any]:
        async with semaphore:
            t0 = time.monotonic()
            try:
                output = await evaluator(input_text)
                elapsed = (time.monotonic() - t0) * 1000
                return {"index": index, "input": input_text, "output": output, "duration_ms": elapsed}
            except Exception as exc:
                elapsed = (time.monotonic() - t0) * 1000
                return {"index": index, "input": input_text, "error": str(exc), "duration_ms": elapsed}

    tasks = [asyncio.create_task(_run(i, inp)) for i, inp in enumerate(inputs)]

    for coro in asyncio.as_completed(tasks):
        result = await coro
        progress.completed += 1
        if "error" in result:
            progress.failed += 1
        progress.elapsed_ms = (time.monotonic() - start) * 1000
        if on_progress:
            on_progress(progress)
        yield result


async def batch_read(
    fetcher: Callable[[int, int], Coroutine[Any, Any, list[T]]],
    *,
    limit: int = 100,
    max_pages: int = 100,
) -> list[T]:
    """Read all pages from a paginated API endpoint.

    Args:
        fetcher: Async function(offset, limit) -> list of items.
        limit: Page size.
        max_pages: Safety cap on number of pages.
    """
    all_items: list[T] = []
    offset = 0
    for _ in range(max_pages):
        page = await fetcher(offset, limit)
        if not page:
            break
        all_items.extend(page)
        if len(page) < limit:
            break
        offset += limit
    return all_items
