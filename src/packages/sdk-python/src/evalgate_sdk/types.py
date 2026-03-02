"""Data models for the EvalAI SDK, matching the TypeScript SDK's types.ts."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

TMetadata = TypeVar("TMetadata", bound=dict[str, Any])


def to_camel(s: str) -> str:
    """Convert snake_case to camelCase for API serialization."""
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


class CamelModel(BaseModel):
    """Base model that serializes to/from camelCase for API compatibility."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


# ── Client config ────────────────────────────────────────────────────


class RetryConfig(BaseModel):
    max_attempts: int = 3
    backoff: Literal["exponential", "linear", "fixed"] = "exponential"
    retryable_errors: list[str] = Field(default_factory=lambda: ["RATE_LIMIT_EXCEEDED", "TIMEOUT", "NETWORK_ERROR"])


class ClientConfig(BaseModel):
    api_key: str | None = None
    base_url: str | None = None
    organization_id: int | None = None
    timeout: int = 30_000
    debug: bool = False
    log_level: Literal["trace", "debug", "info", "warn", "error"] = "info"
    retry: RetryConfig = Field(default_factory=RetryConfig)
    enable_caching: bool = True
    cache_size: int = 1000
    enable_batching: bool = True
    batch_size: int = 10
    batch_delay: int = 50
    keep_alive: bool = True


# ── Evaluation templates ─────────────────────────────────────────────


class EvaluationTemplates(str, Enum):
    UNIT_TESTING = "unit-testing"
    OUTPUT_QUALITY = "output-quality"
    PROMPT_OPTIMIZATION = "prompt-optimization"
    CHAIN_OF_THOUGHT = "chain-of-thought"
    LONG_CONTEXT_TESTING = "long-context-testing"
    MODEL_STEERING = "model-steering"
    REGRESSION_TESTING = "regression-testing"
    CONFIDENCE_CALIBRATION = "confidence-calibration"
    SAFETY_COMPLIANCE = "safety-compliance"
    RAG_EVALUATION = "rag-evaluation"
    CODE_GENERATION = "code-generation"
    SUMMARIZATION = "summarization"


# ── Feature usage ────────────────────────────────────────────────────


class FeatureUsage(CamelModel):
    feature_id: str
    unlimited: bool
    interval: str
    remaining: int | None = None
    limit: int | None = None
    used: int | None = None


class OrganizationLimits(CamelModel):
    organization_id: int
    plan: str
    features: list[FeatureUsage]


class Organization(CamelModel):
    id: int
    name: str
    slug: str | None = None
    plan: str | None = None


# ── Traces & Spans ───────────────────────────────────────────────────


class Trace(CamelModel):
    id: int
    trace_id: str
    name: str | None = None
    organization_id: int | None = None
    status: str | None = None
    input: str | None = None
    output: str | None = None
    metadata: dict[str, Any] | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    duration_ms: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CreateTraceParams(CamelModel):
    name: str
    trace_id: str | None = None
    input: str | None = None
    output: str | None = None
    metadata: dict[str, Any] | None = None
    organization_id: int | None = None


class UpdateTraceParams(CamelModel):
    name: str | None = None
    output: str | None = None
    status: str | None = None
    metadata: dict[str, Any] | None = None


class ListTracesParams(CamelModel):
    limit: int = 20
    offset: int = 0
    organization_id: int | None = None
    status: str | None = None


class Span(CamelModel):
    id: int
    span_id: str
    trace_id: int
    name: str | None = None
    type: str | None = None
    input: str | None = None
    output: str | None = None
    metadata: dict[str, Any] | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    duration_ms: int | None = None


class CreateSpanParams(CamelModel):
    name: str
    span_id: str | None = None
    type: str | None = None
    input: str | None = None
    output: str | None = None
    metadata: dict[str, Any] | None = None


# ── Evaluations ──────────────────────────────────────────────────────


class Evaluation(CamelModel):
    id: int
    name: str
    description: str | None = None
    type: str | None = None
    status: str | None = None
    organization_id: int | None = None
    created_by: str | None = None
    model_settings: dict[str, Any] | None = None
    execution_settings: dict[str, Any] | None = None
    custom_metrics: list[dict[str, Any]] | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CreateEvaluationParams(CamelModel):
    name: str
    description: str | None = None
    type: str | None = None
    organization_id: int | None = None
    model_settings: dict[str, Any] | None = None
    execution_settings: dict[str, Any] | None = None
    assertions: list[dict[str, Any]] | None = None
    test_cases: list[dict[str, Any]] | None = None


class UpdateEvaluationParams(CamelModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    model_settings: dict[str, Any] | None = None
    execution_settings: dict[str, Any] | None = None


class ListEvaluationsParams(CamelModel):
    limit: int = 20
    offset: int = 0
    status: str | None = None


# ── Test Cases ───────────────────────────────────────────────────────


class TestCase(CamelModel):
    id: int
    evaluation_id: int
    name: str | None = None
    input: str | None = None
    expected_output: str | None = None
    metadata: dict[str, Any] | None = None


class CreateTestCaseParams(CamelModel):
    name: str | None = None
    input: str
    expected_output: str | None = None
    metadata: dict[str, Any] | None = None


# ── Evaluation Runs ──────────────────────────────────────────────────


class EvaluationRun(CamelModel):
    id: int
    evaluation_id: int
    status: str | None = None
    total_cases: int | None = None
    passed_cases: int | None = None
    failed_cases: int | None = None
    score: float | None = None
    trace_log: dict[str, Any] | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None


class CreateRunParams(CamelModel):
    model_settings: dict[str, Any] | None = None
    execution_settings: dict[str, Any] | None = None


# ── LLM Judge ────────────────────────────────────────────────────────


class LLMJudgeConfig(CamelModel):
    id: int
    name: str
    model: str | None = None
    criteria: dict[str, Any] | None = None
    settings: dict[str, Any] | None = None


class CreateLLMJudgeConfigParams(CamelModel):
    name: str
    model: str = "gpt-4"
    criteria: dict[str, Any] | None = None
    settings: dict[str, Any] | None = None
    organization_id: int | None = None


class LLMJudgeResult(CamelModel):
    id: int
    config_id: int | None = None
    score: float | None = None
    reasoning: str | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime | None = None


class RunLLMJudgeParams(CamelModel):
    config_id: int
    input: str
    output: str
    expected_output: str | None = None
    context: str | None = None


class ListLLMJudgeConfigsParams(CamelModel):
    limit: int = 20
    offset: int = 0


class ListLLMJudgeResultsParams(CamelModel):
    config_id: int | None = None
    limit: int = 20
    offset: int = 0


class LLMJudgeAlignment(CamelModel):
    alignment_score: float | None = None
    details: dict[str, Any] | None = None


class GetLLMJudgeAlignmentParams(CamelModel):
    config_id: int


# ── Annotations ──────────────────────────────────────────────────────


class Annotation(CamelModel):
    id: int
    evaluation_run_id: int | None = None
    test_case_id: int | None = None
    annotator_id: str | None = None
    rating: int | None = None
    feedback: str | None = None
    labels: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime | None = None


class CreateAnnotationParams(CamelModel):
    evaluation_run_id: int
    test_case_id: int
    rating: int | None = None
    feedback: str | None = None
    labels: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class ListAnnotationsParams(CamelModel):
    evaluation_run_id: int | None = None
    test_case_id: int | None = None
    limit: int = 20
    offset: int = 0


class AnnotationTask(CamelModel):
    id: int
    name: str | None = None
    status: str | None = None
    settings: dict[str, Any] | None = None
    created_at: datetime | None = None


class CreateAnnotationTaskParams(CamelModel):
    name: str
    evaluation_id: int
    settings: dict[str, Any] | None = None
    organization_id: int | None = None


class ListAnnotationTasksParams(CamelModel):
    limit: int = 20
    offset: int = 0


class AnnotationItem(CamelModel):
    id: int
    task_id: int
    content: dict[str, Any] | None = None
    status: str | None = None


class CreateAnnotationItemParams(CamelModel):
    content: dict[str, Any]


class ListAnnotationItemsParams(CamelModel):
    status: str | None = None
    limit: int = 20
    offset: int = 0


# ── API Keys ─────────────────────────────────────────────────────────


class APIKey(CamelModel):
    id: int
    name: str
    key_prefix: str | None = None
    scopes: list[str] | None = None
    last_used_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime | None = None


class APIKeyWithSecret(APIKey):
    key: str


class CreateAPIKeyParams(CamelModel):
    name: str
    scopes: list[str] | None = None
    expires_at: str | None = None
    organization_id: int | None = None


class UpdateAPIKeyParams(CamelModel):
    name: str | None = None
    scopes: list[str] | None = None


class ListAPIKeysParams(CamelModel):
    organization_id: int | None = None


class APIKeyUsage(CamelModel):
    total_requests: int = 0
    requests_today: int = 0
    last_used_at: datetime | None = None


# ── Webhooks ─────────────────────────────────────────────────────────


class Webhook(CamelModel):
    id: int
    url: str
    events: list[str] | None = None
    active: bool = True
    created_at: datetime | None = None


class CreateWebhookParams(CamelModel):
    url: str
    events: list[str]
    organization_id: int | None = None


class UpdateWebhookParams(CamelModel):
    url: str | None = None
    events: list[str] | None = None
    active: bool | None = None


class ListWebhooksParams(CamelModel):
    organization_id: int | None = None


class WebhookDelivery(CamelModel):
    id: int
    webhook_id: int
    event: str | None = None
    status_code: int | None = None
    response_body: str | None = None
    created_at: datetime | None = None


class ListWebhookDeliveriesParams(CamelModel):
    limit: int = 20
    offset: int = 0


# ── Usage ────────────────────────────────────────────────────────────


class UsageStats(CamelModel):
    total_requests: int = 0
    total_evaluations: int = 0
    total_traces: int = 0
    period_start: datetime | None = None
    period_end: datetime | None = None


class GetUsageParams(CamelModel):
    organization_id: int
    start_date: str | None = None
    end_date: str | None = None


class UsageSummary(CamelModel):
    evaluations: int = 0
    traces: int = 0
    test_cases: int = 0
    api_calls: int = 0


# ── Quality Score ────────────────────────────────────────────────────


class QualityBreakdown(CamelModel):
    pass_rate: float | None = None
    safety: float | None = None
    judge: float | None = None


class QualityScore(CamelModel):
    score: float | None = None
    total: int | None = None
    evidence_level: str | None = None
    baseline_score: float | None = None
    regression_delta: float | None = None
    baseline_missing: bool | None = None
    breakdown: QualityBreakdown | None = None
    flags: list[str] | None = None
    evaluation_run_id: int | None = None
    evaluation_id: int | None = None
    avg_latency_ms: float | None = None
    cost_usd: float | None = None
    baseline_cost_usd: float | None = None
    baseline_run_id: int | None = None


# ── Test Suite ───────────────────────────────────────────────────────


class TestSuiteCase(BaseModel):
    name: str
    input: str
    expected_output: str | None = None
    assertions: list[dict[str, Any]] | None = None
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None


class TestSuiteConfig(BaseModel):
    model: str | None = None
    provider: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    system_prompt: str | None = None
    evaluator: Any | None = None
    test_cases: list[TestSuiteCase] = Field(default_factory=list)
    timeout: int = 30_000


class TestSuiteCaseResult(BaseModel):
    model_config = {"arbitrary_types_allowed": True}

    name: str
    passed: bool
    duration_ms: int = 0
    input: str
    output: str | None = None
    expected_output: str | None = None
    assertions: list[Any] = Field(default_factory=list)
    error: str | None = None


class TestSuiteResult(BaseModel):
    suite_name: str
    passed: bool
    total: int = 0
    passed_count: int = 0
    failed_count: int = 0
    duration_ms: int = 0
    results: list[TestSuiteCaseResult] = Field(default_factory=list)


# ── Workflow types ───────────────────────────────────────────────────


class WorkflowNode(CamelModel):
    id: str
    type: str
    name: str | None = None
    config: dict[str, Any] | None = None


class WorkflowEdge(CamelModel):
    source: str = Field(alias="from")
    target: str = Field(alias="to")
    condition: str | None = None
    label: str | None = None


class WorkflowDefinition(CamelModel):
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]
    entrypoint: str | None = None
    metadata: dict[str, Any] | None = None


class WorkflowStatus(str, Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class HandoffType(str, Enum):
    DELEGATION = "delegation"
    ESCALATION = "escalation"
    COLLABORATION = "collaboration"
    FALLBACK = "fallback"


class AgentHandoff(CamelModel):
    from_agent: str | None = None
    to_agent: str
    context: dict[str, Any] | None = None
    handoff_type: HandoffType = HandoffType.DELEGATION
    timestamp: datetime | None = None


class DecisionType(str, Enum):
    ROUTING = "routing"
    SELECTION = "selection"
    FILTERING = "filtering"
    PRIORITIZATION = "prioritization"


class DecisionAlternative(CamelModel):
    name: str
    score: float | None = None
    reasoning: str | None = None


class RecordDecisionParams(CamelModel):
    agent_name: str
    decision_type: DecisionType = DecisionType.ROUTING
    chosen: str
    alternatives: list[DecisionAlternative] = Field(default_factory=list)
    reasoning: str | None = None
    confidence: float | None = None
    input_context: dict[str, Any] | None = None


class CostCategory(str, Enum):
    LLM_INPUT = "llm_input"
    LLM_OUTPUT = "llm_output"
    EMBEDDING = "embedding"
    TOOL_CALL = "tool_call"
    OTHER = "other"


class RecordCostParams(CamelModel):
    agent_name: str
    category: CostCategory
    amount: float
    currency: str = "USD"
    model: str | None = None
    tokens: int | None = None
    metadata: dict[str, Any] | None = None


class CostRecord(CamelModel):
    agent_name: str
    category: CostCategory
    amount: float
    currency: str = "USD"
    model: str | None = None
    tokens: int | None = None
    metadata: dict[str, Any] | None = None
    timestamp: datetime | None = None


class WorkflowContext(CamelModel):
    workflow_id: str | None = None
    trace_id: int | None = None
    name: str
    status: WorkflowStatus = WorkflowStatus.RUNNING
    definition: WorkflowDefinition | None = None
    metadata: dict[str, Any] | None = None
    started_at: datetime | None = None


class AgentSpanContext(CamelModel):
    span_id: str | None = None
    agent_name: str
    trace_id: int | None = None
    parent_span_id: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
