/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DriftSeverityBadge } from "@/components/drift-severity-badge";
import type { BehavioralDriftResult } from "@/lib/drift/behavioral-drift";

const NO_DRIFT: BehavioralDriftResult = {
	driftDetected: false,
	signals: [],
	overallDriftScore: 0,
	baselineWindow: {
		label: "baseline",
		traceCount: 100,
		avgConfidence: 0.8,
		cotUsageRate: 0.6,
		toolCallRate: 0.5,
		errorRate: 0.02,
	},
	currentWindow: {
		label: "current",
		traceCount: 100,
		avgConfidence: 0.82,
		cotUsageRate: 0.61,
		toolCallRate: 0.51,
		errorRate: 0.02,
	},
};

const HIGH_DRIFT: BehavioralDriftResult = {
	driftDetected: true,
	signals: [
		{
			type: "confidence_drop",
			description: "Confidence dropped by 30%",
			delta: -0.3,
			relativeChange: -0.37,
			severity: "high",
		},
		{
			type: "error_spike",
			description: "Error rate spiked to 25%",
			delta: 0.2,
			relativeChange: 10.0,
			severity: "critical",
		},
	],
	overallDriftScore: 0.75,
	baselineWindow: {
		label: "baseline",
		traceCount: 100,
		avgConfidence: 0.8,
		cotUsageRate: 0.6,
		toolCallRate: 0.5,
		errorRate: 0.02,
	},
	currentWindow: {
		label: "current",
		traceCount: 100,
		avgConfidence: 0.5,
		cotUsageRate: 0.6,
		toolCallRate: 0.5,
		errorRate: 0.25,
	},
};

const MEDIUM_DRIFT: BehavioralDriftResult = {
	driftDetected: true,
	signals: [
		{
			type: "cot_usage_drop",
			description: "CoT usage dropped",
			delta: -0.15,
			relativeChange: -0.25,
			severity: "medium",
		},
	],
	overallDriftScore: 0.3,
	baselineWindow: {
		label: "baseline",
		traceCount: 50,
		avgConfidence: 0.7,
		cotUsageRate: 0.6,
		toolCallRate: 0.4,
		errorRate: 0.05,
	},
	currentWindow: {
		label: "current",
		traceCount: 50,
		avgConfidence: 0.7,
		cotUsageRate: 0.45,
		toolCallRate: 0.4,
		errorRate: 0.05,
	},
};

describe("DriftSeverityBadge", () => {
	it("shows 'No drift' when no drift detected", () => {
		render(<DriftSeverityBadge result={NO_DRIFT} />);
		expect(screen.getByText(/No drift/)).toBeDefined();
	});

	it("shows 'Critical drift' when critical signal present", () => {
		render(<DriftSeverityBadge result={HIGH_DRIFT} />);
		expect(screen.getByText(/Critical drift/)).toBeDefined();
	});

	it("shows 'Moderate drift' for medium severity", () => {
		render(<DriftSeverityBadge result={MEDIUM_DRIFT} />);
		expect(screen.getByText(/Moderate drift/)).toBeDefined();
	});

	it("shows signal count in badge", () => {
		render(<DriftSeverityBadge result={HIGH_DRIFT} />);
		expect(screen.getByText(/\(2\)/)).toBeDefined();
	});

	it("does not show signals list by default", () => {
		render(<DriftSeverityBadge result={HIGH_DRIFT} />);
		expect(screen.queryByText(/Confidence dropped/)).toBeNull();
	});

	it("shows signal descriptions when showSignals=true", () => {
		render(<DriftSeverityBadge result={HIGH_DRIFT} showSignals />);
		expect(screen.getByText(/Confidence dropped by 30%/)).toBeDefined();
	});

	it("caps visible signals at 3 and shows overflow count", () => {
		const manySignals: BehavioralDriftResult = {
			...HIGH_DRIFT,
			signals: Array.from({ length: 5 }, (_, i) => ({
				type: "error_spike" as const,
				description: `Signal ${i + 1}`,
				delta: 0.1,
				relativeChange: 0.5,
				severity: "medium" as const,
			})),
		};
		render(<DriftSeverityBadge result={manySignals} showSignals />);
		expect(screen.getByText(/\+2 more signal/)).toBeDefined();
	});
});
