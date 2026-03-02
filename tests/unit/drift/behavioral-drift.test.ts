import { describe, expect, it } from "vitest";
import {
	type BehavioralWindow,
	detectBehavioralDrift,
} from "@/lib/drift/behavioral-drift";

const baseline: BehavioralWindow = {
	label: "baseline",
	traceCount: 100,
	cotUsageRate: 0.8,
	avgReasoningConfidence: 0.85,
	toolUsageRates: { search: 0.9, calculator: 0.6 },
	avgToolSuccessRate: 0.95,
	retrievalRate: 0.7,
	errorRate: 0.02,
};

const identical: BehavioralWindow = { ...baseline, label: "current-same" };

describe("detectBehavioralDrift — no drift", () => {
	it("returns no drift for identical windows", () => {
		const result = detectBehavioralDrift(baseline, identical);
		expect(result.driftDetected).toBe(false);
		expect(result.signals).toHaveLength(0);
		expect(result.overallSeverity).toBe("none");
	});

	it("ignores small CoT changes below threshold", () => {
		const current = { ...baseline, cotUsageRate: 0.75 }; // -0.05, below 0.2 threshold
		const result = detectBehavioralDrift(baseline, current);
		const cotSignals = result.signals.filter(
			(s) => s.type === "cot_usage_drop",
		);
		expect(cotSignals).toHaveLength(0);
	});
});

describe("detectBehavioralDrift — CoT drift", () => {
	it("detects CoT usage drop", () => {
		const current = { ...baseline, label: "current", cotUsageRate: 0.5 }; // -0.3
		const result = detectBehavioralDrift(baseline, current);
		expect(result.driftDetected).toBe(true);
		expect(result.signals.some((s) => s.type === "cot_usage_drop")).toBe(true);
	});

	it("CoT drop has negative delta", () => {
		const current = { ...baseline, label: "current", cotUsageRate: 0.5 };
		const result = detectBehavioralDrift(baseline, current);
		const signal = result.signals.find((s) => s.type === "cot_usage_drop")!;
		expect(signal.delta).toBeLessThan(0);
	});

	it("detects CoT usage spike", () => {
		const current = {
			...baseline,
			label: "current",
			cotUsageRate: 0.1,
			avgReasoningConfidence: null,
		};
		const noCoT = {
			...baseline,
			label: "baseline-low",
			cotUsageRate: 0.1,
			avgReasoningConfidence: null,
		};
		const result = detectBehavioralDrift(noCoT, {
			...baseline,
			label: "current",
			cotUsageRate: 0.6,
		});
		expect(result.signals.some((s) => s.type === "cot_usage_spike")).toBe(true);
	});
});

describe("detectBehavioralDrift — confidence drift", () => {
	it("detects confidence drop", () => {
		const current = {
			...baseline,
			label: "current",
			avgReasoningConfidence: 0.65,
		}; // -0.2
		const result = detectBehavioralDrift(baseline, current);
		expect(result.signals.some((s) => s.type === "confidence_drop")).toBe(true);
	});

	it("no confidence signal when both null", () => {
		const b = { ...baseline, avgReasoningConfidence: null };
		const c = { ...b, label: "current" };
		const result = detectBehavioralDrift(b, c);
		expect(result.signals.some((s) => s.type === "confidence_drop")).toBe(
			false,
		);
	});
});

describe("detectBehavioralDrift — tool drift", () => {
	it("detects tool dropped", () => {
		const current = {
			...baseline,
			label: "current",
			toolUsageRates: { search: 0.5, calculator: 0.6 }, // search dropped from 0.9 to 0.5
		};
		const result = detectBehavioralDrift(baseline, current);
		expect(result.signals.some((s) => s.type === "tool_dropped")).toBe(true);
	});

	it("detects tool added", () => {
		const current = {
			...baseline,
			label: "current",
			toolUsageRates: { search: 0.9, calculator: 0.6, new_tool: 0.5 },
		};
		const result = detectBehavioralDrift(baseline, current);
		expect(result.signals.some((s) => s.type === "tool_added")).toBe(true);
	});

	it("detects tool success rate drop", () => {
		const current = { ...baseline, label: "current", avgToolSuccessRate: 0.7 }; // -0.25
		const result = detectBehavioralDrift(baseline, current);
		expect(result.signals.some((s) => s.type === "tool_success_drop")).toBe(
			true,
		);
	});
});

describe("detectBehavioralDrift — retrieval and error", () => {
	it("detects retrieval drop", () => {
		const current = { ...baseline, label: "current", retrievalRate: 0.3 }; // -0.4
		const result = detectBehavioralDrift(baseline, current);
		expect(result.signals.some((s) => s.type === "retrieval_drop")).toBe(true);
	});

	it("detects error spike", () => {
		const current = { ...baseline, label: "current", errorRate: 0.2 }; // +0.18
		const result = detectBehavioralDrift(baseline, current);
		expect(result.signals.some((s) => s.type === "error_spike")).toBe(true);
	});

	it("does not flag retrieval drop when baseline has no retrieval", () => {
		const noRetrieval = { ...baseline, retrievalRate: 0.01 };
		const current = { ...baseline, label: "current", retrievalRate: 0.0 };
		const result = detectBehavioralDrift(noRetrieval, current);
		expect(result.signals.some((s) => s.type === "retrieval_drop")).toBe(false);
	});
});

describe("detectBehavioralDrift — severity", () => {
	it("overall severity is none when no drift", () => {
		const result = detectBehavioralDrift(baseline, identical);
		expect(result.overallSeverity).toBe("none");
	});

	it("overall severity is critical for large error spike", () => {
		const current = { ...baseline, label: "current", errorRate: 0.5 };
		const result = detectBehavioralDrift(baseline, current);
		expect(["critical", "high"]).toContain(result.overallSeverity);
	});

	it("includes baseline and current labels", () => {
		const result = detectBehavioralDrift(baseline, {
			...baseline,
			label: "current",
		});
		expect(result.baselineLabel).toBe("baseline");
		expect(result.currentLabel).toBe("current");
	});
});
