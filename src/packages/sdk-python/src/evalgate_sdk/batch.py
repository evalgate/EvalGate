"""Request batching and concurrent processing utilities."""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Callable, Coroutine
from typing import Any, TypeVar

T = TypeVar("T")
R = TypeVar("R")

_BATCHABLE_ENDPOINTS = {"/api/traces", "/api/evaluations", "/api/annotations"}


def can_batch(method: str, endpoint: str) -> bool:
    """Check if a request is eligible for batching (POST to known endpoints)."""
    return method.upper() == "POST" and any(endpoint.startswith(ep) for ep in _BATCHABLE_ENDPOINTS)


class RequestBatcher:
    """Accumulates requests and flushes them in batches.

    Usage::

        batcher = RequestBatcher(flush_fn=my_http_batch, max_batch_size=10)
        result = await batcher.enqueue("POST", "/api/traces", body={...})
    """

    def __init__(
        self,
        flush_fn: Callable[[list[dict[str, Any]]], Any],
        max_batch_size: int = 10,
        delay_ms: int = 50,
    ) -> None:
        self._flush_fn = flush_fn
        self._max_batch_size = max_batch_size
        self._delay = delay_ms / 1000
        self._queue: list[dict[str, Any]] = []
        self._pending: dict[str, asyncio.Future[Any]] = {}
        self._timer: asyncio.TimerHandle | None = None

    async def enqueue(
        self,
        method: str,
        endpoint: str,
        body: Any | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        request_id = str(uuid.uuid4())
        loop = asyncio.get_running_loop()
        future: asyncio.Future[Any] = loop.create_future()
        self._pending[request_id] = future

        self._queue.append(
            {
                "id": request_id,
                "method": method,
                "endpoint": endpoint,
                "body": body,
                "headers": headers or {},
            }
        )

        if len(self._queue) >= self._max_batch_size:
            await self.flush()
        elif self._timer is None:
            self._timer = loop.call_later(self._delay, lambda: asyncio.ensure_future(self.flush()))

        return await future

    async def flush(self) -> None:
        if not self._queue:
            return

        if self._timer is not None:
            self._timer.cancel()
            self._timer = None

        batch = self._queue[:]
        self._queue.clear()

        try:
            results = await self._flush_fn(batch)
            if isinstance(results, list):
                for req, result in zip(batch, results, strict=False):
                    fut = self._pending.pop(req["id"], None)
                    if fut and not fut.done():
                        fut.set_result(result)
            else:
                for req in batch:
                    fut = self._pending.pop(req["id"], None)
                    if fut and not fut.done():
                        fut.set_result(results)
        except Exception as exc:
            for req in batch:
                fut = self._pending.pop(req["id"], None)
                if fut and not fut.done():
                    fut.set_exception(exc)

    def clear(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None
        for fut in self._pending.values():
            if not fut.done():
                fut.cancel()
        self._queue.clear()
        self._pending.clear()

    def get_stats(self) -> dict[str, int]:
        return {"queue_size": len(self._queue), "max_batch_size": self._max_batch_size}


async def batch_process(
    items: list[T],
    processor: Callable[[T], Coroutine[Any, Any, R]],
    concurrency: int = 5,
    *,
    continue_on_error: bool = False,
    on_progress: Callable[[int, int], None] | None = None,
) -> list[R]:
    """Process items with bounded concurrency.

    Args:
        items: Items to process.
        processor: Async function to apply to each item.
        concurrency: Max concurrent tasks.
        continue_on_error: If True, collect errors instead of raising.
        on_progress: Optional callback (completed, total).

    Returns:
        Results in same order as items.
    """
    semaphore = asyncio.Semaphore(concurrency)
    results: list[R | None] = [None] * len(items)
    errors: list[Exception | None] = [None] * len(items)
    completed = 0

    async def _run(index: int, item: T) -> None:
        nonlocal completed
        async with semaphore:
            try:
                results[index] = await processor(item)
            except Exception as exc:
                if continue_on_error:
                    errors[index] = exc
                else:
                    raise
            finally:
                completed += 1
                if on_progress:
                    on_progress(completed, len(items))

    await asyncio.gather(*[_run(i, item) for i, item in enumerate(items)])

    if not continue_on_error:
        return [r for r in results if r is not None] if None not in results else results  # type: ignore[return-value]
    return results  # type: ignore[return-value]
