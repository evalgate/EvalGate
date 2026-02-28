"""AutoGen tracing integration — wraps AutoGen conversations with EvalAI workflow traces."""

from __future__ import annotations

from typing import Any

from evalai_sdk.workflows import WorkflowStatus, WorkflowTracer


def trace_autogen(
    conversation: Any,
    tracer: WorkflowTracer,
    *,
    conversation_name: str = "AutoGenConversation",
) -> Any:
    """Wrap an AutoGen conversation so ``initiate_chat`` is traced as a full workflow.

    Returns a lightweight proxy; the original conversation is not modified.

    Args:
        conversation: An AutoGen agent or ``ConversableAgent`` with
            ``.initiate_chat()`` or ``.a_initiate_chat()`` methods.
        tracer: An active ``WorkflowTracer`` instance.
        conversation_name: Name used for the workflow and spans.

    Example::

        from autogen import ConversableAgent
        from evalai_sdk import WorkflowTracer, AIEvalClient

        client = AIEvalClient.init()
        tracer = WorkflowTracer(client)
        agent = ConversableAgent(...)

        traced = trace_autogen(agent, tracer, conversation_name="CodeReview")
        result = await traced.initiate_chat(recipient, message="Review this PR")
    """

    class _TracedAutoGen:
        def __init__(self, original: Any) -> None:
            self._original = original

        async def initiate_chat(self, *args: Any, **kwargs: Any) -> Any:
            await tracer.start_workflow(conversation_name)
            span = await tracer.start_agent_span(conversation_name, {"args": str(args), "kwargs": str(kwargs)})
            try:
                if hasattr(self._original, "a_initiate_chat"):
                    result = await self._original.a_initiate_chat(*args, **kwargs)
                else:
                    result = await self._original.initiate_chat(*args, **kwargs)
                await tracer.end_agent_span(span, output={"result": str(result)})
                await tracer.end_workflow({"result": str(result)}, WorkflowStatus.COMPLETED)
                return result
            except Exception as exc:
                await tracer.end_agent_span(span, error=str(exc))
                await tracer.end_workflow({"error": str(exc)}, WorkflowStatus.FAILED)
                raise

        def __getattr__(self, name: str) -> Any:
            return getattr(self._original, name)

    return _TracedAutoGen(conversation)
