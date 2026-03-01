"""Tests for WorkflowTracer."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from evalgate_sdk.types import (
    CostCategory,
    HandoffType,
    RecordCostParams,
    RecordDecisionParams,
    Trace,
    WorkflowStatus,
)
from evalgate_sdk.workflows import WorkflowTracer, create_workflow_tracer, trace_workflow_step


def _make_mock_client():
    client = MagicMock()
    client.traces = MagicMock()
    client.traces.create = AsyncMock(return_value=Trace(id=1, trace_id="t-1"))
    client.traces.update = AsyncMock()
    client.traces.create_span = AsyncMock()
    return client


class TestWorkflowTracer:
    @pytest.mark.asyncio
    async def test_start_and_end_workflow(self):
        client = _make_mock_client()
        tracer = WorkflowTracer(client)

        ctx = await tracer.start_workflow("test-workflow")
        assert ctx.name == "test-workflow"
        assert ctx.status == WorkflowStatus.RUNNING
        assert tracer.is_workflow_active()

        await tracer.end_workflow(status=WorkflowStatus.COMPLETED)
        client.traces.update.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_agent_spans(self):
        client = _make_mock_client()
        tracer = WorkflowTracer(client)
        await tracer.start_workflow("w")

        span = await tracer.start_agent_span("agent-1", {"query": "hi"})
        assert span.agent_name == "agent-1"
        client.traces.create_span.assert_awaited_once()

        await tracer.end_agent_span(span, output={"answer": "hello"})

    @pytest.mark.asyncio
    async def test_record_handoff(self):
        client = _make_mock_client()
        tracer = WorkflowTracer(client)

        await tracer.record_handoff("agent-1", "agent-2", handoff_type=HandoffType.ESCALATION)
        handoffs = tracer.get_handoffs()
        assert len(handoffs) == 1
        assert handoffs[0].to_agent == "agent-2"
        assert handoffs[0].handoff_type == HandoffType.ESCALATION

    @pytest.mark.asyncio
    async def test_record_decision(self):
        client = _make_mock_client()
        tracer = WorkflowTracer(client)

        await tracer.record_decision(
            RecordDecisionParams(
                agent_name="router",
                chosen="path-a",
                reasoning="higher confidence",
            )
        )
        decisions = tracer.get_decisions()
        assert len(decisions) == 1
        assert decisions[0].chosen == "path-a"

    @pytest.mark.asyncio
    async def test_cost_tracking(self):
        client = _make_mock_client()
        tracer = WorkflowTracer(client)

        await tracer.record_cost(
            RecordCostParams(
                agent_name="gpt-agent",
                category=CostCategory.LLM_INPUT,
                amount=0.05,
                tokens=1000,
            )
        )
        await tracer.record_cost(
            RecordCostParams(
                agent_name="gpt-agent",
                category=CostCategory.LLM_OUTPUT,
                amount=0.10,
                tokens=500,
            )
        )

        assert tracer.get_total_cost() == pytest.approx(0.15)
        breakdown = tracer.get_cost_breakdown()
        assert breakdown["llm_input"] == pytest.approx(0.05)
        assert breakdown["llm_output"] == pytest.approx(0.10)

    @pytest.mark.asyncio
    async def test_not_active_without_start(self):
        client = _make_mock_client()
        tracer = WorkflowTracer(client)
        assert not tracer.is_workflow_active()
        assert tracer.get_current_workflow() is None


class TestFactory:
    def test_create_workflow_tracer(self):
        client = _make_mock_client()
        tracer = create_workflow_tracer(client, session_id="s-1")
        assert tracer._session_id == "s-1"


class TestTraceWorkflowStep:
    @pytest.mark.asyncio
    async def test_traces_function(self):
        client = _make_mock_client()
        tracer = WorkflowTracer(client)
        await tracer.start_workflow("w")

        result = await trace_workflow_step(tracer, "agent-1", lambda: "done")
        assert result == "done"

    @pytest.mark.asyncio
    async def test_traces_async_function(self):
        client = _make_mock_client()
        tracer = WorkflowTracer(client)
        await tracer.start_workflow("w")

        async def _async_fn():
            return "async-done"

        result = await trace_workflow_step(tracer, "agent-1", _async_fn)
        assert result == "async-done"

    @pytest.mark.asyncio
    async def test_traces_error(self):
        client = _make_mock_client()
        tracer = WorkflowTracer(client)
        await tracer.start_workflow("w")

        with pytest.raises(RuntimeError):
            await trace_workflow_step(tracer, "agent-1", lambda: (_ for _ in ()).throw(RuntimeError("fail")))
