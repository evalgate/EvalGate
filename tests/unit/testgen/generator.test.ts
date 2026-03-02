import { describe, expect, it } from "vitest";
import {
	createFailureReport,
	FailureCategory,
	FailureSeverity,
} from "@/lib/failures/taxonomy";
import { generateFromTrace } from "@/lib/testgen/generator";
import type { TraceForMinimization } from "@/lib/testgen/trace-minimizer";

const baseTrace: TraceForMinimization = {
	traceId: "trace-gen-1",
	spans: [
		{
			spanId: "span-1",
			name: "llm-call",
			type: "llm",
			input: "What is the refund policy?",
			output: "I am sorry, but I am unable to help with that request.",
			messages: [
				{ role: "system", content: "You are a helpful assistant." },
				{ role: "user", content: "What is the refund policy?" },
				{
					role: "assistant",
					content: "I am sorry, but I am unable to help with that request.",
				},
			],
		},
	],
};

describe("generateFromTrace", () => {
	it("produces an EvalCase with quarantined: true", () => {
		const result = generateFromTrace({ trace: baseTrace });
		expect(result.quarantined).toBe(true);
		expect(result.evalCase.quarantined).toBe(true);
	});

	it("uses traceId as sourceTraceId", () => {
		const result = generateFromTrace({ trace: baseTrace });
		expect(result.evalCase.sourceTraceIds).toContain("trace-gen-1");
	});

	it("includes auto-generated tag", () => {
		const result = generateFromTrace({ trace: baseTrace });
		expect(result.evalCase.tags).toContain("auto-generated");
	});

	it("extracts system prompt tag correctly", () => {
		const result = generateFromTrace({ trace: baseTrace });
		expect(result.evalCase.tags).toContain("has-system-prompt");
	});

	it("includes failure category in title when failure report provided", () => {
		const failure = createFailureReport({
			id: "fail-1",
			traceId: "trace-gen-1",
			category: FailureCategory.REFUSAL,
			severity: FailureSeverity.MEDIUM,
			description: "Model refused",
			confidence: 0.85,
			detectedBy: "rule-based-v1",
		});

		const result = generateFromTrace({
			trace: baseTrace,
			failureReport: failure,
		});
		expect(result.evalCase.title).toContain("refusal");
	});

	it("adds failure category tag when failure report provided", () => {
		const failure = createFailureReport({
			id: "fail-2",
			traceId: "trace-gen-1",
			category: FailureCategory.HALLUCINATION,
			severity: FailureSeverity.HIGH,
			description: "Hallucination detected",
			confidence: 0.9,
			detectedBy: "rule-based-v1",
		});

		const result = generateFromTrace({
			trace: baseTrace,
			failureReport: failure,
		});
		expect(result.evalCase.tags).toContain(FailureCategory.HALLUCINATION);
	});

	it("generates constraints from failure category", () => {
		const failure = createFailureReport({
			id: "fail-3",
			traceId: "trace-gen-1",
			category: FailureCategory.REFUSAL,
			severity: FailureSeverity.MEDIUM,
			description: "Refusal",
			confidence: 0.85,
			detectedBy: "rule-based-v1",
		});

		const result = generateFromTrace({
			trace: baseTrace,
			failureReport: failure,
		});
		expect(result.evalCase.expectedConstraints.length).toBeGreaterThan(0);
	});

	it("refusal constraint uses matches_regex with valid JS regex syntax", () => {
		const failure = createFailureReport({
			id: "fail-regex",
			traceId: "trace-gen-1",
			category: FailureCategory.REFUSAL,
			severity: FailureSeverity.HIGH,
			description: "Refusal detected",
			confidence: 0.9,
			detectedBy: "rule-based-v1",
		});
		const result = generateFromTrace({
			trace: baseTrace,
			failureReport: failure,
		});
		const refusalConstraint = result.evalCase.expectedConstraints.find(
			(c) => c.type === "matches_regex",
		);
		expect(refusalConstraint).toBeDefined();
		// Must be a valid JavaScript regex — new RegExp() must not throw
		expect(() => new RegExp(refusalConstraint!.value as string)).not.toThrow();
		// Must NOT use PCRE-only (?i) inline flag (invalid in JS)
		expect(refusalConstraint!.value as string).not.toContain("(?i)");
	});

	it("includes extra tags", () => {
		const result = generateFromTrace({
			trace: baseTrace,
			extraTags: ["smoke-test", "priority:high"],
		});
		expect(result.evalCase.tags).toContain("smoke-test");
		expect(result.evalCase.tags).toContain("priority:high");
	});

	it("provides a rationale string", () => {
		const result = generateFromTrace({ trace: baseTrace });
		expect(typeof result.rationale).toBe("string");
		expect(result.rationale.length).toBeGreaterThan(10);
	});

	it("minimizedInput contains userPrompt", () => {
		const result = generateFromTrace({ trace: baseTrace });
		expect(result.minimizedInput.userPrompt.length).toBeGreaterThan(0);
	});

	it("sets default redaction profile ref", () => {
		const result = generateFromTrace({ trace: baseTrace });
		expect(result.evalCase.redactionProfileRef).toBe("default");
	});

	it("accepts custom rubric ref", () => {
		const result = generateFromTrace({
			trace: baseTrace,
			rubricRef: "rubric-abc",
		});
		expect(result.evalCase.rubricRef).toBe("rubric-abc");
	});

	it("generates unique IDs for different traces", () => {
		const trace2: TraceForMinimization = {
			traceId: "trace-gen-2",
			spans: [
				{ spanId: "s-1", name: "llm", type: "llm", input: "Different prompt" },
			],
		};
		const r1 = generateFromTrace({ trace: baseTrace });
		const r2 = generateFromTrace({ trace: trace2 });
		expect(r1.evalCase.id).not.toBe(r2.evalCase.id);
	});
});
