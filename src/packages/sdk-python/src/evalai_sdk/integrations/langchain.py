"""LangChain tracing integration — wraps LangChain executors with EvalAI workflow traces."""

from __future__ import annotations

from typing import Any

from evalai_sdk.workflows import WorkflowTracer


def trace_langchain(
    executor: Any,
    tracer: WorkflowTracer,
    *,
    agent_name: str = "LangChainAgent",
) -> Any:
    """Wrap a LangChain executor so ``invoke`` and ``call`` are traced.

    Returns a lightweight proxy; the original executor is not modified.

    Args:
        executor: A LangChain ``AgentExecutor``, ``RunnableSequence``, or any
            object with ``.invoke()`` / ``.call()`` methods.
        tracer: An active ``WorkflowTracer`` instance.
        agent_name: Name used for spans (defaults to ``"LangChainAgent"``).

    Example::

        from langchain.agents import AgentExecutor
        from evalai_sdk import WorkflowTracer, AIEvalClient

        client = AIEvalClient.init()
        tracer = WorkflowTracer(client)
        executor = AgentExecutor(...)

        traced = trace_langchain(executor, tracer, agent_name="ResearchAgent")
        result = await traced.invoke({"query": "What is AI safety?"})
    """

    class _TracedLangChain:
        def __init__(self, original: Any) -> None:
            self._original = original

        async def invoke(self, input: Any, config: Any = None, **kwargs: Any) -> Any:
            span = await tracer.start_agent_span(agent_name, {"input": str(input)})
            try:
                if hasattr(self._original, "ainvoke"):
                    result = await self._original.ainvoke(input, config, **kwargs)
                else:
                    result = await self._original.invoke(input, config, **kwargs)
                await tracer.end_agent_span(span, output={"result": str(result)})
                return result
            except Exception as exc:
                await tracer.end_agent_span(span, error=str(exc))
                raise

        async def call(self, input: Any, config: Any = None, **kwargs: Any) -> Any:
            span = await tracer.start_agent_span(agent_name, {"input": str(input)})
            try:
                result = await self._original.call(input, config, **kwargs)
                await tracer.end_agent_span(span, output={"result": str(result)})
                return result
            except Exception as exc:
                await tracer.end_agent_span(span, error=str(exc))
                raise

        def __getattr__(self, name: str) -> Any:
            return getattr(self._original, name)

    return _TracedLangChain(executor)
