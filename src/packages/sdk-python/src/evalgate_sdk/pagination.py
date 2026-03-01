"""Cursor-based pagination helpers — iterators, auto-pagination, and encoding."""

from __future__ import annotations

import base64
import json
from collections.abc import AsyncIterator
from typing import Any, Callable, Generic, TypeVar

T = TypeVar("T")


def encode_cursor(data: Any) -> str:
    """Encode arbitrary data as a base64 cursor string."""
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode()


def decode_cursor(cursor: str) -> Any:
    """Decode a base64 cursor string back to its original value."""
    return json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())


class PaginatedResponse(Generic[T]):
    """Container for a page of results plus pagination metadata."""

    def __init__(self, data: list[T], has_more: bool, total: int | None = None) -> None:
        self.data = data
        self.has_more = has_more
        self.total = total


class PaginatedIterator(Generic[T]):
    """Async iterator that automatically fetches pages.

    Usage::

        pages = PaginatedIterator(fetch_fn, limit=20)
        async for page in pages:
            for item in page:
                print(item)

        # or collect everything
        all_items = await pages.to_list()
    """

    def __init__(
        self,
        fetch_fn: Callable[[int, int], Any],
        limit: int = 20,
    ) -> None:
        self._fetch_fn = fetch_fn
        self._limit = limit
        self._offset = 0
        self._exhausted = False

    def __aiter__(self) -> PaginatedIterator[T]:
        return self

    async def __anext__(self) -> list[T]:
        if self._exhausted:
            raise StopAsyncIteration

        result = await self._fetch_fn(self._offset, self._limit)

        if isinstance(result, dict):
            data = result.get("data", [])
            has_more = result.get("has_more", result.get("hasMore", False))
        elif isinstance(result, PaginatedResponse):
            data = result.data
            has_more = result.has_more
        elif isinstance(result, list):
            data = result
            has_more = len(data) >= self._limit
        else:
            data = list(result)
            has_more = len(data) >= self._limit

        if not data:
            self._exhausted = True
            raise StopAsyncIteration

        self._offset += len(data)
        if not has_more:
            self._exhausted = True

        return data

    async def to_list(self) -> list[T]:
        """Collect all pages into a single flat list."""
        items: list[T] = []
        async for page in self:
            items.extend(page)
        return items

    def reset(self) -> None:
        self._offset = 0
        self._exhausted = False


def create_paginated_iterator(
    fetch_fn: Callable[[int, int], Any],
    limit: int = 20,
) -> PaginatedIterator[Any]:
    """Create a paginated iterator from a fetch function."""
    return PaginatedIterator(fetch_fn, limit)


async def auto_paginate(
    fetch_fn: Callable[[int, int], Any],
    limit: int = 20,
) -> AsyncIterator[Any]:
    """Auto-paginate and yield individual items."""
    iterator = PaginatedIterator(fetch_fn, limit)
    async for page in iterator:
        for item in page:
            yield item


def create_pagination_meta(
    items: list[Any],
    limit: int,
    offset: int,
    total: int | None = None,
) -> dict[str, Any]:
    """Create pagination metadata for an API response."""
    return {
        "limit": limit,
        "offset": offset,
        "count": len(items),
        "total": total,
        "has_more": total is not None and (offset + len(items)) < total if total else len(items) >= limit,
    }


def parse_pagination_params(
    params: dict[str, Any] | None = None,
    default_limit: int = 20,
    max_limit: int = 100,
) -> dict[str, int]:
    """Parse and clamp pagination params."""
    if params is None:
        return {"limit": default_limit, "offset": 0}
    limit = min(int(params.get("limit", default_limit)), max_limit)
    offset = max(int(params.get("offset", 0)), 0)
    return {"limit": limit, "offset": offset}
