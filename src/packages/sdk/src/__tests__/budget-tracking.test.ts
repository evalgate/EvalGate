import { describe, expect, it } from "vitest";
import type { NormalizedBudgetConfig } from "../cli/config";
import { evaluateReplayOutcome } from "../cli/replay-decision";

describe("Budget tracking and replay decisions", () => {
	const mockPreviousRun = {
		summary: {
			passRate: 0.85,
			correctedPassRate: 0.82,
			totalCostUsd: 1.2,
		},
		results: Array(100).fill({}), // 100 traces
	};

	const mockCurrentRun = {
		summary: {
			passRate: 0.87,
			correctedPassRate: 0.84,
			totalCostUsd: 1.25,
		},
		results: Array(100).fill({}), // 100 traces
	};

	describe("Trace-count budget mode", () => {
		it("should keep when pass rate improves within budget", () => {
			const budgetConfig: NormalizedBudgetConfig = {
				mode: "traces",
				maxTraces: 150,
			};

			const decision = evaluateReplayOutcome(
				mockPreviousRun,
				mockCurrentRun,
				budgetConfig,
			);

			expect(decision.action).toBe("keep");
			expect(decision.reason).toBe("pass_rate_improved");
			expect(decision.comparisonBasis).toBe("corrected");
			expect(decision.budgetUsed).toBe(100);
			expect(decision.budgetLimit).toBe(150);
		});

		it("should discard when budget exceeded", () => {
			const budgetConfig: NormalizedBudgetConfig = {
				mode: "traces",
				maxTraces: 80,
			};

			const decision = evaluateReplayOutcome(
				mockPreviousRun,
				mockCurrentRun,
				budgetConfig,
			);

			expect(decision.action).toBe("discard");
			expect(decision.reason).toBe("budget_exceeded");
			expect(decision.budgetUsed).toBe(100);
			expect(decision.budgetLimit).toBe(80);
		});

		it("should discard when pass rate declines", () => {
			const decliningRun = {
				summary: {
					passRate: 0.83,
					correctedPassRate: 0.8,
					totalCostUsd: 1.15,
				},
				results: Array(100).fill({}),
			};

			const budgetConfig: NormalizedBudgetConfig = {
				mode: "traces",
				maxTraces: 150,
			};

			const decision = evaluateReplayOutcome(
				mockPreviousRun,
				decliningRun,
				budgetConfig,
			);

			expect(decision.action).toBe("discard");
			expect(decision.reason).toBe("pass_rate_declined");
		});
	});

	describe("Cost budget mode", () => {
		it("should keep when pass rate improves within cost budget", () => {
			const budgetConfig: NormalizedBudgetConfig = {
				mode: "cost",
				maxCostUsd: 2.0,
			};

			const decision = evaluateReplayOutcome(
				mockPreviousRun,
				mockCurrentRun,
				budgetConfig,
			);

			expect(decision.action).toBe("keep");
			expect(decision.reason).toBe("pass_rate_improved");
			expect(decision.budgetUsed).toBe(1.25);
			expect(decision.budgetLimit).toBe(2.0);
		});

		it("should discard when cost budget exceeded", () => {
			const budgetConfig: NormalizedBudgetConfig = {
				mode: "cost",
				maxCostUsd: 1.0,
			};

			const decision = evaluateReplayOutcome(
				mockPreviousRun,
				mockCurrentRun,
				budgetConfig,
			);

			expect(decision.action).toBe("discard");
			expect(decision.reason).toBe("budget_exceeded");
			expect(decision.budgetUsed).toBe(1.25);
			expect(decision.budgetLimit).toBe(1.0);
		});
	});

	describe("Corrected vs raw pass rate comparison", () => {
		it("should use corrected rates when both runs have them", () => {
			const decision = evaluateReplayOutcome(mockPreviousRun, mockCurrentRun, {
				mode: "traces",
				maxTraces: 150,
			});

			expect(decision.comparisonBasis).toBe("corrected");
			expect(decision.previousCorrectedPassRate).toBe(0.82);
			expect(decision.newCorrectedPassRate).toBe(0.84);
		});

		it("should use raw rates when corrected rates are null", () => {
			const runWithoutCorrection = {
				summary: {
					passRate: 0.87,
					correctedPassRate: null,
					totalCostUsd: 1.25,
				},
				results: Array(100).fill({}),
			};

			const decision = evaluateReplayOutcome(
				mockPreviousRun,
				runWithoutCorrection,
				{
					mode: "traces",
					maxTraces: 150,
				},
			);

			expect(decision.comparisonBasis).toBe("raw");
			expect(decision.previousCorrectedPassRate).toBe(0.82);
			expect(decision.newCorrectedPassRate).toBe(null);
		});

		it("should use raw rates when judge is too weak", () => {
			const weakJudgeRun = {
				summary: {
					passRate: 0.87,
					// undefined means judge was too weak to correct
					correctedPassRate: undefined,
					totalCostUsd: 1.25,
				},
				results: Array(100).fill({}),
			};

			const decision = evaluateReplayOutcome(mockPreviousRun, weakJudgeRun, {
				mode: "traces",
				maxTraces: 150,
			});

			expect(decision.comparisonBasis).toBe("raw");
		});
	});
});
