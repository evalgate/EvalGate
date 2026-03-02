import { describe, expect, it } from "vitest";
import {
	detectRuleBased,
	RULE_BASED_DETECTOR_ID,
} from "@/lib/failures/detectors/rule-based";
import { FailureCategory } from "@/lib/failures/taxonomy";

describe("detectRuleBased", () => {
	it("detects refusal pattern", () => {
		const signals = detectRuleBased({
			output: "I am sorry, but I am unable to help with that request.",
		});
		expect(signals.length).toBeGreaterThan(0);
		expect(signals.some((s) => s.category === FailureCategory.REFUSAL)).toBe(
			true,
		);
	});

	it("detects hallucination pattern", () => {
		const signals = detectRuleBased({
			output: "As an AI language model, I don't have access to real-time data.",
		});
		expect(
			signals.some((s) => s.category === FailureCategory.HALLUCINATION),
		).toBe(true);
	});

	it("detects incomplete response", () => {
		const signals = detectRuleBased({
			output: "The solution to your problem is...",
		});
		const incomplete = detectRuleBased({ output: "Here are the steps..." });
		const incomplete2 = detectRuleBased({ output: "The answer is..." });
		// Simple check — ellipsis at end
		const signals2 = detectRuleBased({ output: "The result is..." });
		expect(
			signals2.some((s) => s.category === FailureCategory.INCOMPLETE),
		).toBe(true);
	});

	it("detects compliance violation with PII mention", () => {
		const signals = detectRuleBased({
			output: "The user's credit card number: 4111111111111111",
		});
		expect(
			signals.some((s) => s.category === FailureCategory.COMPLIANCE_VIOLATION),
		).toBe(true);
	});

	it("detects latency regression", () => {
		const signals = detectRuleBased({
			output: "response",
			latencyMs: 5000,
			expectedLatencyMs: 1000,
		});
		expect(
			signals.some((s) => s.category === FailureCategory.LATENCY_REGRESSION),
		).toBe(true);
	});

	it("does not flag latency when within 2x", () => {
		const signals = detectRuleBased({
			output: "response",
			latencyMs: 1500,
			expectedLatencyMs: 1000,
		});
		expect(
			signals.some((s) => s.category === FailureCategory.LATENCY_REGRESSION),
		).toBe(false);
	});

	it("detects cost regression", () => {
		const signals = detectRuleBased({
			output: "response",
			costUsd: 0.05,
			expectedCostUsd: 0.01,
		});
		expect(
			signals.some((s) => s.category === FailureCategory.COST_REGRESSION),
		).toBe(true);
	});

	it("falls back to OTHER for error messages with no pattern match", () => {
		const signals = detectRuleBased({
			output: "",
			errorMessage: "Internal server error: timeout at layer 7",
		});
		expect(signals.some((s) => s.category === FailureCategory.OTHER)).toBe(
			true,
		);
	});

	it("returns empty array for clean output", () => {
		const signals = detectRuleBased({
			output: "Here is your answer: 42.",
		});
		expect(signals).toHaveLength(0);
	});

	it("all signals use the correct detectorId", () => {
		const signals = detectRuleBased({
			output: "I am sorry, but I am unable to help.",
		});
		for (const s of signals) {
			expect(s.detectorId).toBe(RULE_BASED_DETECTOR_ID);
		}
	});

	it("signals have confidence between 0 and 1", () => {
		const signals = detectRuleBased({
			output: "I cannot assist with this request.",
		});
		for (const s of signals) {
			expect(s.rawConfidence).toBeGreaterThanOrEqual(0);
			expect(s.rawConfidence).toBeLessThanOrEqual(1);
		}
	});

	it("signals have weight between 0 and 1", () => {
		const signals = detectRuleBased({
			output: "I am sorry, but I am unable to help.",
			latencyMs: 9000,
			expectedLatencyMs: 1000,
		});
		for (const s of signals) {
			expect(s.weight).toBeGreaterThan(0);
			expect(s.weight).toBeLessThanOrEqual(1);
		}
	});

	it("detects retrieval failure", () => {
		const signals = detectRuleBased({
			output: "No documents found for your query. Context not available.",
		});
		expect(
			signals.some((s) => s.category === FailureCategory.RETRIEVAL_FAILURE),
		).toBe(true);
	});
});
