/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FailureConfidenceBadge } from "@/components/failure-confidence-badge";
import type { AggregatedConfidence } from "@/lib/failures/confidence";

const HIGH_CONF_REFUSAL: AggregatedConfidence = {
	category: "refusal",
	confidence: 0.92,
	agreementCount: 3,
	totalDetectors: 3,
	agreementRatio: 1.0,
	scores: { refusal: 0.92 },
};

const LOW_CONF_HALLUCINATION: AggregatedConfidence = {
	category: "hallucination",
	confidence: 0.45,
	agreementCount: 1,
	totalDetectors: 3,
	agreementRatio: 0.33,
	scores: { hallucination: 0.45, refusal: 0.2, unknown: 0.1 },
};

const TOOL_MISUSE: AggregatedConfidence = {
	category: "tool_misuse",
	confidence: 0.7,
	agreementCount: 2,
	totalDetectors: 3,
	agreementRatio: 0.67,
	scores: { tool_misuse: 0.7 },
};

describe("FailureConfidenceBadge", () => {
	it("renders category label for refusal", () => {
		render(<FailureConfidenceBadge result={HIGH_CONF_REFUSAL} />);
		expect(screen.getByText("Refusal")).toBeDefined();
	});

	it("renders category label for hallucination", () => {
		render(<FailureConfidenceBadge result={LOW_CONF_HALLUCINATION} />);
		expect(screen.getByText("Hallucination")).toBeDefined();
	});

	it("renders category label for tool_misuse", () => {
		render(<FailureConfidenceBadge result={TOOL_MISUSE} />);
		expect(screen.getByText("Tool Misuse")).toBeDefined();
	});

	it("shows confidence percentage", () => {
		render(<FailureConfidenceBadge result={HIGH_CONF_REFUSAL} />);
		expect(screen.getByText("92%")).toBeDefined();
	});

	it("shows 45% for low confidence result", () => {
		render(<FailureConfidenceBadge result={LOW_CONF_HALLUCINATION} />);
		expect(screen.getByText("45%")).toBeDefined();
	});

	it("does not show agreement details by default", () => {
		render(<FailureConfidenceBadge result={HIGH_CONF_REFUSAL} />);
		expect(screen.queryByText(/detectors/)).toBeNull();
	});

	it("shows detector agreement when showAgreement=true", () => {
		render(<FailureConfidenceBadge result={HIGH_CONF_REFUSAL} showAgreement />);
		expect(screen.getByText(/3\/3 detectors/)).toBeDefined();
	});

	it("shows partial agreement count", () => {
		render(
			<FailureConfidenceBadge result={LOW_CONF_HALLUCINATION} showAgreement />,
		);
		expect(screen.getByText(/1\/3 detectors/)).toBeDefined();
	});
});
