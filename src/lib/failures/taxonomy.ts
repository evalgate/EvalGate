/**
 * Failure Taxonomy — Normalized failure categories and the FailureReport type.
 *
 * Extends the existing 6-category DebugAgentService taxonomy with new
 * categories required for structured agent evaluation.
 * Failures are knowledge objects: they know their causes, derived tests,
 * and which regressions they prevented.
 */

// ── Failure categories ────────────────────────────────────────────────────────

export const FailureCategory = {
	// Original categories (DebugAgentService)
	HALLUCINATION: "hallucination",
	REFUSAL: "refusal",
	OFF_TOPIC: "off_topic",
	FORMATTING: "formatting",
	INCOMPLETE: "incomplete",
	OTHER: "other",

	// New categories (EvalGate extension)
	REASONING_ERROR: "reasoning_error",
	TOOL_SELECTION_ERROR: "tool_selection_error",
	COMPLIANCE_VIOLATION: "compliance_violation",
	RETRIEVAL_FAILURE: "retrieval_failure",
	LATENCY_REGRESSION: "latency_regression",
	COST_REGRESSION: "cost_regression",
} as const;

export type FailureCategory =
	(typeof FailureCategory)[keyof typeof FailureCategory];

// ── Severity ──────────────────────────────────────────────────────────────────

export const FailureSeverity = {
	CRITICAL: "critical",
	HIGH: "high",
	MEDIUM: "medium",
	LOW: "low",
} as const;

export type FailureSeverity =
	(typeof FailureSeverity)[keyof typeof FailureSeverity];

// ── Suggested fix types ───────────────────────────────────────────────────────

export const SuggestedFixType = {
	PROMPT_EDIT: "prompt_edit",
	PARAMETER_CHANGE: "parameter_change",
	MODEL_SWITCH: "model_switch",
	DATA_FIX: "data_fix",
	TOOL_RECONFIGURATION: "tool_reconfiguration",
	RETRIEVAL_TUNING: "retrieval_tuning",
	COMPLIANCE_RULE: "compliance_rule",
} as const;

export type SuggestedFixType =
	(typeof SuggestedFixType)[keyof typeof SuggestedFixType];

// ── Core types ────────────────────────────────────────────────────────────────

export interface SuggestedFix {
	type: SuggestedFixType;
	description: string;
	confidence: number;
}

export interface FailureLineage {
	/** Trace IDs that triggered this failure */
	causedByTraceIds: string[];
	/** Regression IDs this failure has blocked from shipping */
	preventedRegressionIds: string[];
	/** Cluster ID for deduplication of similar failures */
	clusterId: string | null;
	/** Test case IDs derived from this failure */
	derivedTestCaseIds: string[];
}

export interface FailureReport {
	/** Unique ID for this failure report */
	id: string;
	/** Trace ID that produced this failure */
	traceId: string;
	/** Span ID within the trace (null if trace-level failure) */
	spanId: string | null;
	/** Evaluation run that detected this failure */
	evaluationRunId: string | null;
	/** Primary failure category */
	category: FailureCategory;
	/** Secondary categories (e.g., hallucination + formatting) */
	secondaryCategories: FailureCategory[];
	/** Severity level */
	severity: FailureSeverity;
	/** Human-readable description of the failure */
	description: string;
	/** Evidence from the trace (output excerpt, assertion that failed) */
	evidence: string | null;
	/** Confidence in the classification (0-1) */
	confidence: number;
	/** Detector that produced this classification */
	detectedBy: string;
	/** Suggested fixes */
	suggestedFixes: SuggestedFix[];
	/** Lineage knowledge */
	lineage: FailureLineage;
	/** ISO-8601 creation timestamp */
	createdAt: string;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export interface CreateFailureReportInput {
	id: string;
	traceId: string;
	spanId?: string | null;
	evaluationRunId?: string | null;
	category: FailureCategory;
	secondaryCategories?: FailureCategory[];
	severity: FailureSeverity;
	description: string;
	evidence?: string | null;
	confidence: number;
	detectedBy: string;
	suggestedFixes?: SuggestedFix[];
	causedByTraceIds?: string[];
}

export function createFailureReport(
	input: CreateFailureReportInput,
): FailureReport {
	return {
		id: input.id,
		traceId: input.traceId,
		spanId: input.spanId ?? null,
		evaluationRunId: input.evaluationRunId ?? null,
		category: input.category,
		secondaryCategories: input.secondaryCategories ?? [],
		severity: input.severity,
		description: input.description,
		evidence: input.evidence ?? null,
		confidence: input.confidence,
		detectedBy: input.detectedBy,
		suggestedFixes: input.suggestedFixes ?? [],
		lineage: {
			causedByTraceIds: input.causedByTraceIds ?? [input.traceId],
			preventedRegressionIds: [],
			clusterId: null,
			derivedTestCaseIds: [],
		},
		createdAt: new Date().toISOString(),
	};
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Default severity by category */
export const CATEGORY_DEFAULT_SEVERITY: Record<
	FailureCategory,
	FailureSeverity
> = {
	[FailureCategory.COMPLIANCE_VIOLATION]: FailureSeverity.CRITICAL,
	[FailureCategory.HALLUCINATION]: FailureSeverity.HIGH,
	[FailureCategory.LATENCY_REGRESSION]: FailureSeverity.HIGH,
	[FailureCategory.COST_REGRESSION]: FailureSeverity.HIGH,
	[FailureCategory.REASONING_ERROR]: FailureSeverity.HIGH,
	[FailureCategory.TOOL_SELECTION_ERROR]: FailureSeverity.MEDIUM,
	[FailureCategory.RETRIEVAL_FAILURE]: FailureSeverity.MEDIUM,
	[FailureCategory.REFUSAL]: FailureSeverity.MEDIUM,
	[FailureCategory.OFF_TOPIC]: FailureSeverity.MEDIUM,
	[FailureCategory.FORMATTING]: FailureSeverity.LOW,
	[FailureCategory.INCOMPLETE]: FailureSeverity.LOW,
	[FailureCategory.OTHER]: FailureSeverity.LOW,
};

/** All supported failure categories as a flat array */
export const ALL_FAILURE_CATEGORIES = Object.values(FailureCategory);

/** Category display labels */
export const CATEGORY_LABELS: Record<FailureCategory, string> = {
	[FailureCategory.HALLUCINATION]: "Hallucination",
	[FailureCategory.REFUSAL]: "Refusal",
	[FailureCategory.OFF_TOPIC]: "Off Topic",
	[FailureCategory.FORMATTING]: "Formatting Error",
	[FailureCategory.INCOMPLETE]: "Incomplete Response",
	[FailureCategory.OTHER]: "Other",
	[FailureCategory.REASONING_ERROR]: "Reasoning Error",
	[FailureCategory.TOOL_SELECTION_ERROR]: "Tool Selection Error",
	[FailureCategory.COMPLIANCE_VIOLATION]: "Compliance Violation",
	[FailureCategory.RETRIEVAL_FAILURE]: "Retrieval Failure",
	[FailureCategory.LATENCY_REGRESSION]: "Latency Regression",
	[FailureCategory.COST_REGRESSION]: "Cost Regression",
};
