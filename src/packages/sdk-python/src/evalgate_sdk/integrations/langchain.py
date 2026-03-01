"""LangChain tracing integration — wraps LangChain executors with EvalAI workflow traces."""

from __future__ import annotations

import asyncio
import inspect
import json as _json
from typing import Any

from evalgate_sdk.workflows import WorkflowTracer


def _safe_str(value: Any) -> str:
    """Serialize a value to JSON if possible, else repr."""
    try:
        return _json.dumps(value)
    except (TypeError, ValueError):
        return repr(value)


def trace_langchain(
    executor: Any,
    tracer: WorkflowTracer,
    *,
    agent_name: str = "LangChainAgent",
) -> Any:
    """Wrap a LangChain executor so ``invoke`` and ``ainvoke`` are traced.

    Returns a lightweight proxy; the original executor is not modified.

    Args:
        executor: A LangChain ``AgentExecutor``, ``RunnableSequence``, or any
            object with ``.invoke()`` / ``.ainvoke()`` methods.
        tracer: An active ``WorkflowTracer`` instance.
        agent_name: Name used for spans (defaults to ``"LangChainAgent"``).

    Example::

        from langchain.agents import AgentExecutor
        from evalgate_sdk import WorkflowTracer, AIEvalClient

        client = AIEvalClient.init()
        tracer = WorkflowTracer(client)
        executor = AgentExecutor(...)

        traced = trace_langchain(executor, tracer, agent_name="ResearchAgent")
        result = await traced.ainvoke({"query": "What is AI safety?"})
    """

    class _TracedLangChain:
        def __init__(self, original: Any) -> None:
            self._original = original

        async def ainvoke(self, input: Any, config: Any = None, **kwargs: Any) -> Any:
            span = await tracer.start_agent_span(agent_name, {"input": _safe_str(input)})
            try:
                if hasattr(self._original, "ainvoke"):
                    result = await self._original.ainvoke(input, config, **kwargs)
                else:
                    fn = self._original.invoke
                    if inspect.iscoroutinefunction(fn):
                        result = await fn(input, config, **kwargs)
                    else:
                        result = await asyncio.get_event_loop().run_in_executor(
                            None, lambda: fn(input, config, **kwargs)
                        )
                await tracer.end_agent_span(span, output={"result": _safe_str(result)})
                return result
            except Exception as exc:
                await tracer.end_agent_span(span, error=str(exc))
                raise

        def invoke(self, input: Any, config: Any = None, **kwargs: Any) -> Any:
            import concurrent.futures

            def _run_coro(coro: Any) -> Any:
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                            return pool.submit(asyncio.run, coro).result(timeout=10)
                    return loop.run_until_complete(coro)
                except Exception:
                    return None

            span = _run_coro(tracer.start_agent_span(agent_name, {"input": _safe_str(input)}))
            try:
                result = self._original.invoke(input, config, **kwargs)
                if span is not None:
                    _run_coro(tracer.end_agent_span(span, output={"result": _safe_str(result)}))
                return result
            except Exception as exc:
                if span is not None:
                    _run_coro(tracer.end_agent_span(span, error=str(exc)))
                raise

        def __getattr__(self, name: str) -> Any:
            return getattr(self._original, name)

    return _TracedLangChain(executor)
