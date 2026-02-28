"""Anthropic tracing integration — wraps Anthropic client calls with EvalAI traces."""

from __future__ import annotations

import time
from typing import Any

from evalai_sdk.types import CreateTraceParams


async def trace_anthropic_call(
    client: Any,
    name: str,
    fn: Any,
    *,
    metadata: dict[str, Any] | None = None,
) -> Any:
    """Trace a single Anthropic call.

    Args:
        client: AIEvalClient instance.
        name: Descriptive name for the trace.
        fn: An async callable that performs the Anthropic call.
        metadata: Extra metadata to attach.

    Returns:
        The result of calling *fn*.
    """
    trace = await client.traces.create(
        CreateTraceParams(name=name, metadata={**(metadata or {}), "provider": "anthropic"})
    )
    start = time.monotonic()
    try:
        result = await fn()
        duration_ms = int((time.monotonic() - start) * 1000)

        from evalai_sdk.types import UpdateTraceParams

        output_text = ""
        usage: dict[str, Any] = {}
        if hasattr(result, "content") and result.content:
            parts = result.content
            output_text = parts[0].text if hasattr(parts[0], "text") else str(parts[0])
        if hasattr(result, "usage") and result.usage:
            usage = {
                "input_tokens": result.usage.input_tokens,
                "output_tokens": result.usage.output_tokens,
            }

        await client.traces.update(
            trace.id,
            UpdateTraceParams(
                output=output_text,
                status="completed",
                metadata={"duration_ms": duration_ms, "usage": usage},
            ),
        )
        return result
    except Exception as exc:
        from evalai_sdk.types import UpdateTraceParams

        await client.traces.update(
            trace.id,
            UpdateTraceParams(status="error", metadata={"error": str(exc)}),
        )
        raise


def trace_anthropic(anthropic_client: Any, eval_client: Any, **kwargs: Any) -> Any:
    """Wrap an Anthropic client so every ``messages.create`` call is traced.

    Returns a lightweight proxy; the original client is not modified.
    """

    class _TracedMessages:
        def __init__(self, original: Any) -> None:
            self._original = original

        async def create(self, **kw: Any) -> Any:
            name = kw.get("model", "anthropic-messages")
            return await trace_anthropic_call(
                eval_client,
                name,
                lambda: self._original.create(**kw),
                metadata={"model": kw.get("model"), **kwargs},
            )

    class _TracedAnthropic:
        def __init__(self, original: Any) -> None:
            self.messages = _TracedMessages(original.messages)
            self._original = original

        def __getattr__(self, name: str) -> Any:
            return getattr(self._original, name)

    return _TracedAnthropic(anthropic_client)
