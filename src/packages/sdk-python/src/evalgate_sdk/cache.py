"""LRU request cache with TTL expiration."""

from __future__ import annotations

import hashlib
import json
import time
from collections import OrderedDict
from typing import Any, TypeVar

T = TypeVar("T")


class CacheTTL:
    """Pre-defined TTL values in seconds."""

    SHORT = 30
    MEDIUM = 300
    LONG = 1800
    HOUR = 3600


_CACHEABLE_PREFIXES = (
    "/api/traces",
    "/api/evaluations",
    "/api/organizations",
    "/api/developer",
)


def should_cache(method: str, endpoint: str) -> bool:
    """Check if a request is cacheable (GET to known endpoints)."""
    return method.upper() == "GET" and any(endpoint.startswith(p) for p in _CACHEABLE_PREFIXES)


def get_ttl(endpoint: str) -> int:
    """Return the appropriate TTL for an endpoint."""
    if "/organizations" in endpoint:
        return CacheTTL.LONG
    if "/developer" in endpoint:
        return CacheTTL.MEDIUM
    return CacheTTL.SHORT


class RequestCache:
    """In-memory LRU cache with per-entry TTL.

    Usage::

        cache = RequestCache(max_size=500)
        cache.set("GET", "/api/traces", data, CacheTTL.SHORT)
        hit = cache.get("GET", "/api/traces")  # returns data or None
    """

    def __init__(self, max_size: int = 1000) -> None:
        self._max_size = max_size
        self._store: OrderedDict[str, _CacheEntry] = OrderedDict()

    @staticmethod
    def _key(method: str, url: str, params: Any = None) -> str:
        raw = f"{method.upper()}:{url}"
        if params:
            raw += f":{json.dumps(params, sort_keys=True, default=str)}"
        return hashlib.sha256(raw.encode()).hexdigest()

    def get(self, method: str, url: str, params: Any = None) -> Any | None:
        key = self._key(method, url, params)
        entry = self._store.get(key)
        if entry is None:
            return None
        if entry.is_expired():
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return entry.data

    def set(self, method: str, url: str, data: Any, ttl: int, params: Any = None) -> None:
        key = self._key(method, url, params)
        if key in self._store:
            del self._store[key]
        elif len(self._store) >= self._max_size:
            self._store.popitem(last=False)
        self._store[key] = _CacheEntry(data=data, ttl=ttl)

    def invalidate(self, method: str, url: str, params: Any = None) -> None:
        key = self._key(method, url, params)
        self._store.pop(key, None)

    def invalidate_pattern(self, pattern: str) -> None:
        """Remove all entries whose URL key contains *pattern*."""
        to_remove = [k for k, v in self._store.items() if pattern in v.url_hint]
        for k in to_remove:
            del self._store[k]

    def clear(self) -> None:
        self._store.clear()

    def get_stats(self) -> dict[str, int]:
        return {"size": len(self._store), "max_size": self._max_size}


class _CacheEntry:
    __slots__ = ("data", "expires_at", "url_hint")

    def __init__(self, data: Any, ttl: int, url_hint: str = "") -> None:
        self.data = data
        self.expires_at = time.monotonic() + ttl
        self.url_hint = url_hint

    def is_expired(self) -> bool:
        return time.monotonic() > self.expires_at
