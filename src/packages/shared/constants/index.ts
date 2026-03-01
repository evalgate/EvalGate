// Shared constants for the EvalGate

export const EVALUATION_TYPES = {
	UNIT_TEST: "unit_test",
	HUMAN_EVAL: "human_eval",
	MODEL_EVAL: "model_eval",
	AB_TEST: "ab_test",
} as const;

export const EVALUATION_STATUS = {
	PENDING: "pending",
	RUNNING: "running",
	COMPLETED: "completed",
	FAILED: "failed",
	CANCELLED: "cancelled",
} as const;

export const ORGANIZATION_ROLES = {
	OWNER: "owner",
	ADMIN: "admin",
	MEMBER: "member",
	VIEWER: "viewer",
} as const;

export const SPAN_TYPES = {
	LLM: "llm",
	TOOL: "tool",
	AGENT: "agent",
	RETRIEVAL: "retrieval",
	CUSTOM: "custom",
} as const;

export const TEST_STATUS = {
	PASSED: "passed",
	FAILED: "failed",
	SKIPPED: "skipped",
} as const;

export const ANNOTATION_STATUS = {
	PENDING: "pending",
	IN_PROGRESS: "in_progress",
	COMPLETED: "completed",
	SKIPPED: "skipped",
} as const;

export const AB_TEST_STATUS = {
	DRAFT: "draft",
	RUNNING: "running",
	PAUSED: "paused",
	COMPLETED: "completed",
} as const;

export const METRIC_TYPES = {
	ACCURACY: "accuracy",
	LATENCY: "latency",
	COST: "cost",
	CUSTOM: "custom",
} as const;

export const METRIC_AGGREGATIONS = {
	AVG: "avg",
	SUM: "sum",
	MIN: "min",
	MAX: "max",
	P50: "p50",
	P95: "p95",
	P99: "p99",
} as const;
