/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreLayerBreakdown } from "@/components/score-layer-breakdown";

const GOOD: Parameters<typeof ScoreLayerBreakdown>[0] = {
	reasoning: { score: 0.9, evidenceAvailable: true },
	action: { score: 0.75, evidenceAvailable: true },
	outcome: { score: 0.8, evidenceAvailable: true },
};

const WEAK: Parameters<typeof ScoreLayerBreakdown>[0] = {
	reasoning: { score: 0.3, evidenceAvailable: false },
	action: { score: 0.4, evidenceAvailable: true },
	outcome: { score: 0.2, evidenceAvailable: true },
};

describe("ScoreLayerBreakdown", () => {
	it("renders all three layer labels", () => {
		render(<ScoreLayerBreakdown {...GOOD} />);
		expect(screen.getByText("Reasoning")).toBeDefined();
		expect(screen.getByText("Action")).toBeDefined();
		expect(screen.getByText("Outcome")).toBeDefined();
	});

	it("displays computed composite score", () => {
		render(<ScoreLayerBreakdown {...GOOD} />);
		// composite = (0.9 + 0.75 + 0.8) / 3 = 0.8167 → 82
		expect(screen.getByText("82")).toBeDefined();
	});

	it("uses provided composite score over computed", () => {
		render(<ScoreLayerBreakdown {...GOOD} composite={0.5} />);
		expect(screen.getByText("50")).toBeDefined();
	});

	it("shows 'Excellent' for high scores", () => {
		render(<ScoreLayerBreakdown {...GOOD} composite={0.9} />);
		expect(screen.getByText("Excellent")).toBeDefined();
	});

	it("shows 'Poor' for low scores", () => {
		render(<ScoreLayerBreakdown {...WEAK} composite={0.35} />);
		expect(screen.getByText("Poor")).toBeDefined();
	});

	it("shows 'estimated' badge when evidence is unavailable", () => {
		render(<ScoreLayerBreakdown {...WEAK} />);
		const estimatedBadges = screen.getAllByText("estimated");
		expect(estimatedBadges.length).toBeGreaterThan(0);
	});

	it("does not show 'estimated' when evidence available", () => {
		render(<ScoreLayerBreakdown {...GOOD} />);
		expect(screen.queryByText("estimated")).toBeNull();
	});

	it("renders layer progress bars with aria-labels", () => {
		const { container } = render(<ScoreLayerBreakdown {...GOOD} />);
		const progressBars = container.querySelectorAll("[aria-label]");
		const layerBars = Array.from(progressBars).filter((el) =>
			el.getAttribute("aria-label")?.includes("score"),
		);
		expect(layerBars.length).toBe(3);
	});
});
