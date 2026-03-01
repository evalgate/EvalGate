"""CrewAI tracing integration — wraps CrewAI crews with EvalAI workflow traces."""

from __future__ import annotations

from typing import Any

from evalgate_sdk.workflows import WorkflowStatus, WorkflowTracer


def trace_crewai(
    crew: Any,
    tracer: WorkflowTracer,
    *,
    crew_name: str = "CrewAI",
) -> Any:
    """Wrap a CrewAI ``Crew`` so that ``kickoff`` is traced as a full workflow.

    Returns a lightweight proxy; the original crew is not modified.

    Args:
        crew: A CrewAI ``Crew`` instance with a ``.kickoff()`` method.
        tracer: An active ``WorkflowTracer`` instance.
        crew_name: Name used for the workflow and spans.

    Example::

        from crewai import Crew
        from evalgate_sdk import WorkflowTracer, AIEvalClient

        client = AIEvalClient.init()
        tracer = WorkflowTracer(client)
        crew = Crew(agents=[...], tasks=[...])

        traced = trace_crewai(crew, tracer, crew_name="ResearchCrew")
        result = await traced.kickoff({"topic": "AI Safety"})
    """

    class _TracedCrewAI:
        def __init__(self, original: Any) -> None:
            self._original = original

        async def kickoff(self, input: Any = None, **kwargs: Any) -> Any:
            await tracer.start_workflow(f"{crew_name} Execution")
            span = await tracer.start_agent_span(crew_name, {"input": str(input)})
            try:
                if hasattr(self._original, "akickoff"):
                    result = await self._original.akickoff(input, **kwargs)
                else:
                    result = await self._original.kickoff(input, **kwargs)
                await tracer.end_agent_span(span, output={"result": str(result)})
                await tracer.end_workflow({"result": str(result)}, WorkflowStatus.COMPLETED)
                return result
            except Exception as exc:
                await tracer.end_agent_span(span, error=str(exc))
                await tracer.end_workflow({"error": str(exc)}, WorkflowStatus.FAILED)
                raise

        def __getattr__(self, name: str) -> Any:
            return getattr(self._original, name)

    return _TracedCrewAI(crew)
