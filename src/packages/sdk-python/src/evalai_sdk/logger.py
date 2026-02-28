"""Structured logger with levels, child loggers, and request/response helpers."""

from __future__ import annotations

import logging
import sys
import time
from typing import Any, Callable, Literal

LogLevel = Literal["trace", "debug", "info", "warn", "error"]

_LEVEL_MAP: dict[str, int] = {
    "trace": 5,
    "debug": logging.DEBUG,
    "info": logging.INFO,
    "warn": logging.WARNING,
    "error": logging.ERROR,
}


class Logger:
    """SDK logger with structured output, child loggers, and request tracing."""

    def __init__(
        self,
        *,
        level: LogLevel = "info",
        prefix: str = "evalai",
        handler: Callable[[str, str, Any], None] | None = None,
    ) -> None:
        self._level = level
        self._prefix = prefix
        self._handler = handler
        self._py_logger = logging.getLogger(f"evalai_sdk.{prefix}")
        self._py_logger.setLevel(_LEVEL_MAP.get(level, logging.INFO))
        if not self._py_logger.handlers:
            h = logging.StreamHandler(sys.stderr)
            h.setFormatter(logging.Formatter("%(asctime)s [%(name)s] %(levelname)s %(message)s"))
            self._py_logger.addHandler(h)

    def set_level(self, level: LogLevel) -> None:
        self._level = level
        self._py_logger.setLevel(_LEVEL_MAP.get(level, logging.INFO))

    def is_level_enabled(self, level: LogLevel) -> bool:
        return _LEVEL_MAP.get(level, 0) >= _LEVEL_MAP.get(self._level, 0)

    def _emit(self, level: LogLevel, message: str, data: Any = None) -> None:
        if self._handler:
            self._handler(level, message, data)
            return
        extra = f" {data}" if data is not None else ""
        py_level = _LEVEL_MAP.get(level, logging.INFO)
        self._py_logger.log(py_level, "%s%s", message, extra)

    def trace(self, message: str, data: Any = None) -> None:
        if self.is_level_enabled("trace"):
            self._emit("trace", message, data)

    def debug(self, message: str, data: Any = None) -> None:
        if self.is_level_enabled("debug"):
            self._emit("debug", message, data)

    def info(self, message: str, data: Any = None) -> None:
        if self.is_level_enabled("info"):
            self._emit("info", message, data)

    def warn(self, message: str, data: Any = None) -> None:
        if self.is_level_enabled("warn"):
            self._emit("warn", message, data)

    def error(self, message: str, data: Any = None) -> None:
        if self.is_level_enabled("error"):
            self._emit("error", message, data)

    def log_request(self, method: str, url: str, data: Any = None) -> None:
        self.debug(f"→ {method} {url}", data)

    def log_response(self, method: str, url: str, status: int, duration_ms: float, data: Any = None) -> None:
        self.debug(f"← {method} {url} {status} ({duration_ms:.0f}ms)", data)

    def child(self, prefix: str) -> Logger:
        return Logger(
            level=self._level,
            prefix=f"{self._prefix}.{prefix}",
            handler=self._handler,
        )


class RequestLogger:
    """Convenience wrapper that times request/response pairs."""

    def __init__(self, logger: Logger) -> None:
        self._logger = logger
        self._start: float = 0

    def on_request(self, method: str, url: str, body: Any = None) -> None:
        self._start = time.monotonic()
        self._logger.log_request(method, url, body)

    def on_response(self, method: str, url: str, status: int, body: Any = None) -> None:
        elapsed = (time.monotonic() - self._start) * 1000
        self._logger.log_response(method, url, status, elapsed, body)


_global_logger: Logger | None = None


def create_logger(level: LogLevel = "info", **kwargs: Any) -> Logger:
    return Logger(level=level, **kwargs)


def get_logger() -> Logger:
    global _global_logger
    if _global_logger is None:
        _global_logger = create_logger()
    return _global_logger


def set_logger(logger: Logger) -> None:
    global _global_logger
    _global_logger = logger
