import { describe, expect, it } from "vitest";
import {
	ALL_FAILURE_CATEGORIES,
	CATEGORY_DEFAULT_SEVERITY,
	CATEGORY_LABELS,
	createFailureReport,
	FailureCategory,
	FailureSeverity,
} from "@/lib/failures/taxonomy";

describe("FailureCategory", () => {
	it("has all original DebugAgentService categories", () => {
		expect(FailureCategory.HALLUCINATION).toBe("hallucination");
		expect(FailureCategory.REFUSAL).toBe("refusal");
		expect(FailureCategory.OFF_TOPIC).toBe("off_topic");
		expect(FailureCategory.FORMATTING).toBe("formatting");
		expect(FailureCategory.INCOMPLETE).toBe("incomplete");
		expect(FailureCategory.OTHER).toBe("other");
	});

	it("has all new EvalGate extension categories", () => {
		expect(FailureCategory.REASONING_ERROR).toBe("reasoning_error");
		expect(FailureCategory.TOOL_SELECTION_ERROR).toBe("tool_selection_error");
		expect(FailureCategory.COMPLIANCE_VIOLATION).toBe("compliance_violation");
		expect(FailureCategory.RETRIEVAL_FAILURE).toBe("retrieval_failure");
		expect(FailureCategory.LATENCY_REGRESSION).toBe("latency_regression");
		expect(FailureCategory.COST_REGRESSION).toBe("cost_regression");
	});

	it("ALL_FAILURE_CATEGORIES includes all 12 categories", () => {
		expect(ALL_FAILURE_CATEGORIES).toHaveLength(12);
	});
});

describe("CATEGORY_DEFAULT_SEVERITY", () => {
	it("compliance violation is critical", () => {
		expect(
			CATEGORY_DEFAULT_SEVERITY[FailureCategory.COMPLIANCE_VIOLATION],
		).toBe(FailureSeverity.CRITICAL);
	});

	it("hallucination is high", () => {
		expect(CATEGORY_DEFAULT_SEVERITY[FailureCategory.HALLUCINATION]).toBe(
			FailureSeverity.HIGH,
		);
	});

	it("formatting is low", () => {
		expect(CATEGORY_DEFAULT_SEVERITY[FailureCategory.FORMATTING]).toBe(
			FailureSeverity.LOW,
		);
	});

	it("every category has a default severity", () => {
		for (const cat of ALL_FAILURE_CATEGORIES) {
			expect(CATEGORY_DEFAULT_SEVERITY[cat]).toBeDefined();
		}
	});
});

describe("CATEGORY_LABELS", () => {
	it("every category has a human-readable label", () => {
		for (const cat of ALL_FAILURE_CATEGORIES) {
			expect(CATEGORY_LABELS[cat]).toBeTruthy();
		}
	});
});

describe("createFailureReport", () => {
	it("creates a report with required fields", () => {
		const report = createFailureReport({
			id: "fail-1",
			traceId: "trace-abc",
			category: FailureCategory.HALLUCINATION,
			severity: FailureSeverity.HIGH,
			description: "Model hallucinated a product feature",
			confidence: 0.85,
			detectedBy: "rule-based-v1",
		});

		expect(report.id).toBe("fail-1");
		expect(report.traceId).toBe("trace-abc");
		expect(report.category).toBe("hallucination");
		expect(report.severity).toBe("high");
		expect(report.confidence).toBe(0.85);
		expect(report.spanId).toBeNull();
		expect(report.evaluationRunId).toBeNull();
		expect(report.secondaryCategories).toHaveLength(0);
		expect(report.suggestedFixes).toHaveLength(0);
	});

	it("initializes lineage with empty arrays and null clusterId", () => {
		const report = createFailureReport({
			id: "fail-2",
			traceId: "trace-xyz",
			category: FailureCategory.REFUSAL,
			severity: FailureSeverity.MEDIUM,
			description: "Model refused request",
			confidence: 0.9,
			detectedBy: "rule-based-v1",
		});

		expect(report.lineage.preventedRegressionIds).toHaveLength(0);
		expect(report.lineage.clusterId).toBeNull();
		expect(report.lineage.derivedTestCaseIds).toHaveLength(0);
	});

	it("populates lineage causedByTraceIds from traceId", () => {
		const report = createFailureReport({
			id: "fail-3",
			traceId: "trace-source",
			category: FailureCategory.OTHER,
			severity: FailureSeverity.LOW,
			description: "test",
			confidence: 0.5,
			detectedBy: "rule-based-v1",
		});

		expect(report.lineage.causedByTraceIds).toContain("trace-source");
	});

	it("accepts secondary categories", () => {
		const report = createFailureReport({
			id: "fail-4",
			traceId: "t-1",
			category: FailureCategory.HALLUCINATION,
			secondaryCategories: [FailureCategory.FORMATTING],
			severity: FailureSeverity.HIGH,
			description: "compound failure",
			confidence: 0.75,
			detectedBy: "test",
		});

		expect(report.secondaryCategories).toContain(FailureCategory.FORMATTING);
	});

	it("sets a valid ISO createdAt timestamp", () => {
		const before = Date.now();
		const report = createFailureReport({
			id: "fail-5",
			traceId: "t-1",
			category: FailureCategory.OTHER,
			severity: FailureSeverity.LOW,
			description: "test",
			confidence: 0.5,
			detectedBy: "test",
		});
		const after = Date.now();
		const ts = new Date(report.createdAt).getTime();
		expect(ts).toBeGreaterThanOrEqual(before);
		expect(ts).toBeLessThanOrEqual(after);
	});
});
