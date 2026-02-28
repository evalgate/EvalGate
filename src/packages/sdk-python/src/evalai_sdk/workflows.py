"""WorkflowTracer — multi-agent workflow tracing with handoffs, decisions, and cost tracking."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Callable, TypeVar

from evalai_sdk.types import (
    AgentHandoff,
    AgentSpanContext,
    CostRecord,
    HandoffType,
    RecordCostParams,
    RecordDecisionParams,
    WorkflowContext,
    WorkflowDefinition,
    WorkflowStatus,
)

T = TypeVar("T")


class WorkflowTracer:
    """Traces multi-agent workflows with span tracking, handoffs, decisions, and costs.

    Usage::

        tracer = WorkflowTracer(client)
        ctx = await tracer.start_workflow("my-workflow")
        span = await tracer.start_agent_span("agent-1", {"query": "hello"})
        await tracer.end_agent_span(span, {"response": "hi"})
        await tracer.end_workflow()
    """

    def __init__(self, client: Any, *, session_id: str | None = None) -> None:
        self._client = client
        self._session_id = session_id or str(uuid.uuid4())
        self._workflow: WorkflowContext | None = None
        self._handoffs: list[AgentHandoff] = []
        self._decisions: list[RecordDecisionParams] = []
        self._costs: list[CostRecord] = []
        self._spans: list[AgentSpanContext] = []

    # ── Workflow lifecycle ────────────────────────────────────────

    async def start_workflow(
        self,
        name: str,
        definition: WorkflowDefinition | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> WorkflowContext:
        from evalai_sdk.types import CreateTraceParams

        trace = await self._client.traces.create(
            CreateTraceParams(
                name=name,
                metadata={
                    **(metadata or {}),
                    "workflow": True,
                    "session_id": self._session_id,
                },
            )
        )

        self._workflow = WorkflowContext(
            workflow_id=str(uuid.uuid4()),
            trace_id=trace.id,
            name=name,
            status=WorkflowStatus.RUNNING,
            definition=definition,
            metadata=metadata,
            started_at=datetime.now(timezone.utc),
        )
        return self._workflow

    async def end_workflow(
        self,
        output: dict[str, Any] | None = None,
        status: WorkflowStatus = WorkflowStatus.COMPLETED,
    ) -> None:
        if self._workflow is None:
            return
        self._workflow.status = status
        if self._workflow.trace_id is not None:
            from evalai_sdk.types import UpdateTraceParams

            await self._client.traces.update(
                self._workflow.trace_id,
                UpdateTraceParams(
                    status=status.value,
                    metadata={
                        "output": output,
                        "handoffs": len(self._handoffs),
                        "decisions": len(self._decisions),
                        "total_cost": self.get_total_cost(),
                    },
                ),
            )

    # ── Agent spans ──────────────────────────────────────────────

    async def start_agent_span(
        self,
        agent_name: str,
        input: dict[str, Any] | None = None,
        parent_span_id: str | None = None,
    ) -> AgentSpanContext:
        span_id = str(uuid.uuid4())
        trace_id = self._workflow.trace_id if self._workflow else None

        if trace_id is not None:
            from evalai_sdk.types import CreateSpanParams

            await self._client.traces.create_span(
                trace_id,
                CreateSpanParams(
                    name=agent_name,
                    span_id=span_id,
                    type="agent",
                    input=str(input) if input else None,
                    metadata={"parent_span_id": parent_span_id},
                ),
            )

        ctx = AgentSpanContext(
            span_id=span_id,
            agent_name=agent_name,
            trace_id=trace_id,
            parent_span_id=parent_span_id,
            started_at=datetime.now(timezone.utc),
        )
        self._spans.append(ctx)
        return ctx

    async def end_agent_span(
        self,
        span: AgentSpanContext,
        output: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        # Span completion is tracked via the trace API if needed
        pass

    # ── Handoffs ─────────────────────────────────────────────────

    async def record_handoff(
        self,
        from_agent: str | None,
        to_agent: str,
        context: dict[str, Any] | None = None,
        handoff_type: HandoffType = HandoffType.DELEGATION,
    ) -> None:
        handoff = AgentHandoff(
            from_agent=from_agent,
            to_agent=to_agent,
            context=context,
            handoff_type=handoff_type,
            timestamp=datetime.now(timezone.utc),
        )
        self._handoffs.append(handoff)

    # ── Decision auditing ────────────────────────────────────────

    async def record_decision(self, params: RecordDecisionParams) -> None:
        self._decisions.append(params)

    # ── Cost tracking ────────────────────────────────────────────

    async def record_cost(self, params: RecordCostParams) -> CostRecord:
        record = CostRecord(
            agent_name=params.agent_name,
            category=params.category,
            amount=params.amount,
            currency=params.currency,
            model=params.model,
            tokens=params.tokens,
            metadata=params.metadata,
            timestamp=datetime.now(timezone.utc),
        )
        self._costs.append(record)
        return record

    def get_total_cost(self) -> float:
        return sum(c.amount for c in self._costs)

    def get_cost_breakdown(self) -> dict[str, float]:
        breakdown: dict[str, float] = {}
        for c in self._costs:
            key = c.category.value
            breakdown[key] = breakdown.get(key, 0.0) + c.amount
        return breakdown

    # ── Accessors ────────────────────────────────────────────────

    def get_current_workflow(self) -> WorkflowContext | None:
        return self._workflow

    def is_workflow_active(self) -> bool:
        return self._workflow is not None and self._workflow.status == WorkflowStatus.RUNNING

    def get_handoffs(self) -> list[AgentHandoff]:
        return list(self._handoffs)

    def get_decisions(self) -> list[RecordDecisionParams]:
        return list(self._decisions)

    def get_costs(self) -> list[CostRecord]:
        return list(self._costs)


def create_workflow_tracer(client: Any, **kwargs: Any) -> WorkflowTracer:
    """Factory for WorkflowTracer."""
    return WorkflowTracer(client, **kwargs)


async def trace_workflow_step(
    tracer: WorkflowTracer,
    agent_name: str,
    fn: Callable[[], Any],
    input: dict[str, Any] | None = None,
) -> Any:
    """Convenience wrapper: open a span, run *fn*, close the span."""
    span = await tracer.start_agent_span(agent_name, input)
    try:
        result = fn()
        if hasattr(result, "__await__"):
            result = await result
        await tracer.end_agent_span(span, output={"result": str(result)})
        return result
    except Exception as exc:
        await tracer.end_agent_span(span, error=str(exc))
        raise
