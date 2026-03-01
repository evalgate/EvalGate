"""Tests for Pydantic data models."""

from evalgate_sdk.types import (
    ClientConfig,
    CostCategory,
    CreateTraceParams,
    DecisionType,
    EvaluationTemplates,
    HandoffType,
    RetryConfig,
    Trace,
    WorkflowDefinition,
    WorkflowEdge,
    WorkflowNode,
    WorkflowStatus,
)


class TestClientConfig:
    def test_defaults(self):
        c = ClientConfig()
        assert c.timeout == 30_000
        assert c.debug is False
        assert c.retry.max_attempts == 3

    def test_custom(self):
        c = ClientConfig(api_key="k", timeout=60_000, retry=RetryConfig(max_attempts=5))
        assert c.api_key == "k"
        assert c.retry.max_attempts == 5


class TestTrace:
    def test_from_dict(self):
        t = Trace.model_validate({"id": 1, "trace_id": "abc", "name": "test"})
        assert t.id == 1
        assert t.trace_id == "abc"


class TestCreateTraceParams:
    def test_minimal(self):
        p = CreateTraceParams(name="test")
        d = p.model_dump(exclude_none=True)
        assert d == {"name": "test"}


class TestEnums:
    def test_templates(self):
        assert EvaluationTemplates.RAG_EVALUATION.value == "rag-evaluation"

    def test_workflow_status(self):
        assert WorkflowStatus.COMPLETED.value == "completed"

    def test_handoff_type(self):
        assert HandoffType.ESCALATION.value == "escalation"

    def test_decision_type(self):
        assert DecisionType.ROUTING.value == "routing"

    def test_cost_category(self):
        assert CostCategory.LLM_INPUT.value == "llm_input"


class TestWorkflowDefinition:
    def test_parse(self):
        d = WorkflowDefinition(
            nodes=[WorkflowNode(id="a", type="agent"), WorkflowNode(id="b", type="llm")],
            edges=[WorkflowEdge(**{"from": "a", "to": "b"})],
            entrypoint="a",
        )
        assert len(d.nodes) == 2
        assert d.edges[0].target == "b"
