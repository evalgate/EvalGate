"""OpenAI tracing integration — wraps OpenAI client calls with EvalAI traces."""

from __future__ import annotations

import time
from typing import Any

from evalai_sdk.types import CreateTraceParams


async def trace_openai_call(
    client: Any,
    name: str,
    fn: Any,
    *,
    metadata: dict[str, Any] | None = None,
) -> Any:
    """Trace a single OpenAI call.

    Args:
        client: AIEvalClient instance.
        name: Descriptive name for the trace.
        fn: An async callable that performs the OpenAI call.
        metadata: Extra metadata to attach to the trace.

    Returns:
        The result of calling *fn*.
    """
    trace = await client.traces.create(
        CreateTraceParams(name=name, metadata={**(metadata or {}), "provider": "openai"})
    )
    start = time.monotonic()
    try:
        result = await fn()
        duration_ms = int((time.monotonic() - start) * 1000)
        from evalai_sdk.types import UpdateTraceParams

        output_text = ""
        usage: dict[str, Any] = {}
        if hasattr(result, "choices") and result.choices:
            msg = result.choices[0].message
            output_text = getattr(msg, "content", "") or ""
        if hasattr(result, "usage") and result.usage:
            usage = {
                "prompt_tokens": result.usage.prompt_tokens,
                "completion_tokens": result.usage.completion_tokens,
                "total_tokens": result.usage.total_tokens,
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


def trace_openai(openai_client: Any, eval_client: Any, **kwargs: Any) -> Any:
    """Wrap an OpenAI client so that every ``chat.completions.create`` call is traced.

    This returns a lightweight proxy; the original client is not modified.

    Args:
        openai_client: An ``openai.AsyncOpenAI`` (or ``OpenAI``) instance.
        eval_client: An ``AIEvalClient`` instance.

    Returns:
        A proxy object with the same interface.
    """

    import inspect

    create_fn = getattr(openai_client.chat.completions, "create", None)
    is_async = (
        hasattr(openai_client, "chat")
        and hasattr(openai_client.chat, "completions")
        and inspect.iscoroutinefunction(create_fn)
    )

    class _TracedCompletions:
        def __init__(self, original: Any) -> None:
            self._original = original

        async def create(self, **kw: Any) -> Any:
            name = kw.get("model", "openai-chat")
            return await trace_openai_call(
                eval_client,
                name,
                lambda: self._original.create(**kw),
                metadata={"model": kw.get("model"), **kwargs},
            )

        def __getattr__(self, name: str) -> Any:
            return getattr(self._original, name)

    class _SyncTracedCompletions:
        def __init__(self, original: Any) -> None:
            self._original = original

        def create(self, **kw: Any) -> Any:
            import asyncio

            name = kw.get("model", "openai-chat")
            coro = trace_openai_call(
                eval_client,
                name,
                self._make_async_fn(kw),
                metadata={"model": kw.get("model"), **kwargs},
            )
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                return asyncio.run(coro)
            return loop.run_until_complete(coro)

        def _make_async_fn(self, kw: dict[str, Any]) -> Any:
            orig = self._original

            async def _fn() -> Any:
                return orig.create(**kw)

            return _fn

        def __getattr__(self, name: str) -> Any:
            return getattr(self._original, name)

    class _TracedChat:
        def __init__(self, original: Any, *, use_async: bool) -> None:
            CompletionsCls = _TracedCompletions if use_async else _SyncTracedCompletions
            self.completions = CompletionsCls(original.completions)
            self._original = original

        def __getattr__(self, name: str) -> Any:
            return getattr(self._original, name)

    class _TracedOpenAI:
        def __init__(self, original: Any) -> None:
            self.chat = _TracedChat(original.chat, use_async=is_async)
            self._original = original

        def __getattr__(self, name: str) -> Any:
            return getattr(self._original, name)

    return _TracedOpenAI(openai_client)
