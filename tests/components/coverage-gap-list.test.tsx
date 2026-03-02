/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoverageGapList } from "@/components/coverage-gap-list";
import type { CoverageModel } from "@/lib/dataset/coverage-model";

const GOOD_COVERAGE: CoverageModel = {
	totalTestCases: 20,
	clusters: [],
	gaps: [],
	coverageRatio: 0.9,
	summary: "20 test cases, 90% coverage.",
};

const LOW_COVERAGE: CoverageModel = {
	totalTestCases: 3,
	clusters: [],
	gaps: [
		{
			id: "gap-0",
			description: 'Behavior not well-covered: "partial payment refund"',
			nearestClusterId: "c-0",
			gapDistance: 0.9,
			importance: 0.95,
		},
		{
			id: "gap-1",
			description: 'Behavior not well-covered: "error recovery fallback"',
			nearestClusterId: "c-0",
			gapDistance: 0.85,
			importance: 0.75,
		},
		{
			id: "gap-2",
			description: 'Behavior not well-covered: "multi-language support"',
			nearestClusterId: null,
			gapDistance: 1.0,
			importance: 0.5,
		},
	],
	coverageRatio: 0.3,
	summary: "3 test cases, 30% coverage, 3 gaps.",
};

const MANY_GAPS: CoverageModel = {
	totalTestCases: 5,
	clusters: [],
	gaps: Array.from({ length: 8 }, (_, i) => ({
		id: `gap-${i}`,
		description: `Gap ${i + 1} description`,
		nearestClusterId: null,
		gapDistance: 0.9,
		importance: 0.7,
	})),
	coverageRatio: 0.2,
	summary: "5 tests, 8 gaps.",
};

describe("CoverageGapList", () => {
	it("shows 'No coverage gaps detected' when no gaps", () => {
		render(<CoverageGapList model={GOOD_COVERAGE} />);
		expect(screen.getByText("No coverage gaps detected")).toBeDefined();
	});

	it("shows coverage percentage", () => {
		render(<CoverageGapList model={LOW_COVERAGE} />);
		expect(screen.getByText("30% covered")).toBeDefined();
	});

	it("shows test count badge", () => {
		render(<CoverageGapList model={LOW_COVERAGE} />);
		expect(screen.getByText("3 tests")).toBeDefined();
	});

	it("renders gap descriptions", () => {
		render(<CoverageGapList model={LOW_COVERAGE} />);
		expect(screen.getByText(/partial payment refund/)).toBeDefined();
		expect(screen.getByText(/error recovery fallback/)).toBeDefined();
	});

	it("shows importance labels", () => {
		render(<CoverageGapList model={LOW_COVERAGE} />);
		expect(screen.getByText("Critical")).toBeDefined();
		expect(screen.getByText("High")).toBeDefined();
		expect(screen.getByText("Medium")).toBeDefined();
	});

	it("caps visible gaps at maxVisible (default 5)", () => {
		render(<CoverageGapList model={MANY_GAPS} />);
		expect(screen.getByText(/\+3 more gap/)).toBeDefined();
	});

	it("respects custom maxVisible", () => {
		render(<CoverageGapList model={MANY_GAPS} maxVisible={2} />);
		expect(screen.getByText(/\+6 more gap/)).toBeDefined();
	});

	it("shows green coverage for high ratio", () => {
		const { container } = render(<CoverageGapList model={GOOD_COVERAGE} />);
		const pctEl = container.querySelector(".text-green-400");
		expect(pctEl).not.toBeNull();
	});
});
