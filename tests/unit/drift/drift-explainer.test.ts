import { describe, expect, it } from "vitest";
import {
	type BehavioralWindow,
	detectBehavioralDrift,
} from "@/lib/drift/behavioral-drift";
import { explainDrift } from "@/lib/drift/drift-explainer";

const baseline: BehavioralWindow = {
	label: "baseline",
	traceCount: 100,
	cotUsageRate: 0.8,
	avgReasoningConfidence: 0.85,
	toolUsageRates: { search: 0.9 },
	avgToolSuccessRate: 0.95,
	retrievalRate: 0.7,
	errorRate: 0.02,
};

describe("explainDrift — no drift", () => {
	it("returns no action required when no drift", () => {
		const driftResult = detectBehavioralDrift(baseline, {
			...baseline,
			label: "current",
		});
		const report = explainDrift(driftResult);
		expect(report.requiresAction).toBe(false);
	});

	it("no-drift summary mentions no drift", () => {
		const driftResult = detectBehavioralDrift(baseline, {
			...baseline,
			label: "current",
		});
		const report = explainDrift(driftResult);
		expect(report.notificationSummary.toLowerCase()).toContain("no");
	});

	it("no-drift has no explanations", () => {
		const driftResult = detectBehavioralDrift(baseline, {
			...baseline,
			label: "current",
		});
		const report = explainDrift(driftResult);
		expect(report.explanations).toHaveLength(0);
	});
});

describe("explainDrift — CoT drift", () => {
	it("generates explanation for CoT drop", () => {
		const current = { ...baseline, label: "current", cotUsageRate: 0.3 };
		const driftResult = detectBehavioralDrift(baseline, current);
		const report = explainDrift(driftResult);

		const cotExpl = report.explanations.find((e) =>
			e.headline.toLowerCase().includes("chain-of-thought"),
		);
		expect(cotExpl).toBeDefined();
		expect(cotExpl!.whatChanged).toBeTruthy();
		expect(cotExpl!.whyItMatters).toBeTruthy();
		expect(cotExpl!.suggestedFix).toBeTruthy();
	});

	it("CoT drop marks as soon or immediate urgency", () => {
		const current = { ...baseline, label: "current", cotUsageRate: 0.3 };
		const driftResult = detectBehavioralDrift(baseline, current);
		const report = explainDrift(driftResult);
		const cotExpl = report.explanations[0]!;
		expect(["immediate", "soon"]).toContain(cotExpl.urgency);
	});
});

describe("explainDrift — error spike", () => {
	it("generates explanation for error spike", () => {
		const current = { ...baseline, label: "current", errorRate: 0.3 };
		const driftResult = detectBehavioralDrift(baseline, current);
		const report = explainDrift(driftResult);
		const errExpl = report.explanations.find((e) =>
			e.headline.toLowerCase().includes("error"),
		);
		expect(errExpl).toBeDefined();
	});

	it("error spike requires action", () => {
		const current = { ...baseline, label: "current", errorRate: 0.5 };
		const driftResult = detectBehavioralDrift(baseline, current);
		const report = explainDrift(driftResult);
		expect(report.requiresAction).toBe(true);
	});

	it("notification summary contains alert emoji for immediate", () => {
		const current = { ...baseline, label: "current", errorRate: 0.5 };
		const driftResult = detectBehavioralDrift(baseline, current);
		const report = explainDrift(driftResult);
		expect(report.notificationSummary).toMatch(/🚨|⚠️/);
	});
});

describe("explainDrift — recommendations", () => {
	it("recommendations are non-empty for drift", () => {
		const current = { ...baseline, label: "current", cotUsageRate: 0.3 };
		const driftResult = detectBehavioralDrift(baseline, current);
		const report = explainDrift(driftResult);
		expect(report.recommendations.length).toBeGreaterThan(0);
	});

	it("recommendations include urgency label", () => {
		const current = { ...baseline, label: "current", cotUsageRate: 0.3 };
		const driftResult = detectBehavioralDrift(baseline, current);
		const report = explainDrift(driftResult);
		expect(report.recommendations[0]).toMatch(
			/\[(IMMEDIATE|SOON|MONITOR|INFORMATIONAL)\]/,
		);
	});

	it("immediate urgency items come first in recommendations", () => {
		const current = {
			...baseline,
			label: "current",
			errorRate: 0.5, // error_spike → immediate
			cotUsageRate: 0.59, // borderline cot_usage_drop
		};
		const driftResult = detectBehavioralDrift(baseline, current);
		const report = explainDrift(driftResult);
		if (report.recommendations.length > 1) {
			const firstRec = report.recommendations[0]!;
			expect(
				firstRec.startsWith("[IMMEDIATE]") || firstRec.startsWith("[SOON]"),
			).toBe(true);
		}
	});
});

describe("explainDrift — multi-signal", () => {
	it("explains each signal separately", () => {
		const current = {
			...baseline,
			label: "current",
			cotUsageRate: 0.3,
			errorRate: 0.3,
			avgToolSuccessRate: 0.6,
		};
		const driftResult = detectBehavioralDrift(baseline, current);
		const report = explainDrift(driftResult);
		expect(report.explanations.length).toBeGreaterThan(1);
	});
});
