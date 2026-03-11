import { describe, expect, it } from "vitest";

import {
	buildUtilityInput,
	computeObjectiveReductionRatio,
	computeUtility,
	decideAutoUtilityOutcome,
	evaluateHardVetoes,
	resolvePassRateBasis,
	resolvePassRateBasisFromRuns,
} from "../../cli/auto-utility";

describe("resolvePassRateBasis", () => {
	it("uses corrected pass rates when both runs provide them", () => {
		const resolution = resolvePassRateBasis(
			{ passRate: 0.8, correctedPassRate: 0.78 },
			{ passRate: 0.85, correctedPassRate: 0.83 },
		);

		expect(resolution.passRateBasis).toBe("corrected");
		expect(resolution.baselinePassRate).toBe(0.78);
		expect(resolution.candidatePassRate).toBe(0.83);
		expect(resolution.deltaRatio).toBeCloseTo(0.05, 10);
	});

	it("falls back to raw pass rates when either corrected value is missing", () => {
		const resolution = resolvePassRateBasis(
			{ passRate: 0.8, correctedPassRate: 0.78 },
			{ passRate: 0.85, correctedPassRate: null },
		);

		expect(resolution.passRateBasis).toBe("raw");
		expect(resolution.baselinePassRate).toBe(0.8);
		expect(resolution.candidatePassRate).toBe(0.85);
		expect(resolution.deltaRatio).toBeCloseTo(0.05, 10);
	});

	it("resolves pass-rate basis from full run objects", () => {
		const resolution = resolvePassRateBasisFromRuns(
			{ summary: { passRate: 0.7, correctedPassRate: undefined } },
			{ summary: { passRate: 0.76, correctedPassRate: undefined } },
		);

		expect(resolution.passRateBasis).toBe("raw");
		expect(resolution.deltaRatio).toBeCloseTo(0.06, 10);
	});
});

describe("computeObjectiveReductionRatio", () => {
	it("computes relative reduction against baseline objective rate", () => {
		expect(computeObjectiveReductionRatio(0.5, 0.25)).toBeCloseTo(0.5, 10);
	});

	it("returns a negative value when the objective gets worse from zero baseline", () => {
		expect(computeObjectiveReductionRatio(0, 0.2)).toBeCloseTo(-0.2, 10);
	});
});

describe("buildUtilityInput and computeUtility", () => {
	it("builds ratio-only utility input from experiment metrics", () => {
		const input = buildUtilityInput({
			baselineObjectiveRate: 0.5,
			candidateObjectiveRate: 0.25,
			regressions: 1,
			improvements: 3,
			holdoutRegressions: 0,
			passRateDeltaRatio: 0.04,
			correctedPassRateDeltaRatio: 0.03,
			latencyDeltaRatio: 0.01,
			costDeltaRatio: 0.02,
		});

		expect(input.objectiveReductionRatio).toBeCloseTo(0.5, 10);
		expect(input.passRateDeltaRatio).toBeCloseTo(0.04, 10);
		expect(input.correctedPassRateDeltaRatio).toBeCloseTo(0.03, 10);
	});

	it("computes weighted utility contributions", () => {
		const input = buildUtilityInput({
			baselineObjectiveRate: 0.5,
			candidateObjectiveRate: 0.25,
			regressions: 1,
			improvements: 3,
			holdoutRegressions: 0,
			passRateDeltaRatio: 0.04,
			correctedPassRateDeltaRatio: 0.03,
			latencyDeltaRatio: 0.01,
			costDeltaRatio: 0.02,
		});
		const result = computeUtility(input, {
			objectiveReductionRatio: 1.5,
			regressions: -0.5,
			improvements: 0.25,
			holdoutRegressions: -1,
			passRateDeltaRatio: 2,
			correctedPassRateDeltaRatio: 3,
			latencyDeltaRatio: -0.25,
			costDeltaRatio: -0.1,
		});

		expect(result.contributions).toHaveLength(8);
		expect(result.score).toBeCloseTo(1.1655, 6);
	});
});

describe("evaluateHardVetoes", () => {
	it("vetoes immediately on holdout regressions", () => {
		const veto = evaluateHardVetoes(
			{
				holdoutRegressions: 1,
				criticalFailureModeIncrease: 0,
				latencyDeltaRatio: 0.01,
				costUsd: 0.5,
			},
			{
				maxHoldoutRegressions: 0,
				maxCriticalFailureModeIncrease: 0,
				latencyCeiling: 0.1,
				costCeiling: 1,
			},
		);

		expect(veto.vetoed).toBe(true);
		expect(veto.reason).toBe("holdout_regressions");
	});

	it("vetoes on critical failure mode increases when holdout passes", () => {
		const veto = evaluateHardVetoes(
			{
				holdoutRegressions: 0,
				criticalFailureModeIncrease: 2,
				latencyDeltaRatio: 0.01,
				costUsd: 0.5,
			},
			{
				maxHoldoutRegressions: 0,
				maxCriticalFailureModeIncrease: 0,
			},
		);

		expect(veto.vetoed).toBe(true);
		expect(veto.reason).toBe("critical_failure_mode_increase");
	});

	it("vetoes on latency ceiling when earlier vetoes do not match", () => {
		const veto = evaluateHardVetoes(
			{
				holdoutRegressions: 0,
				criticalFailureModeIncrease: 0,
				latencyDeltaRatio: 0.2,
				costUsd: 0.5,
			},
			{
				latencyCeiling: 0.1,
				costCeiling: 1,
			},
		);

		expect(veto.vetoed).toBe(true);
		expect(veto.reason).toBe("latency_ceiling");
	});

	it("returns a non-veto result when all hard constraints pass", () => {
		const veto = evaluateHardVetoes(
			{
				holdoutRegressions: 0,
				criticalFailureModeIncrease: 0,
				latencyDeltaRatio: 0.01,
				costUsd: 0.5,
			},
			{
				maxHoldoutRegressions: 0,
				maxCriticalFailureModeIncrease: 0,
				latencyCeiling: 0.1,
				costCeiling: 1,
			},
		);

		expect(veto.vetoed).toBe(false);
		expect(veto.reason).toBeNull();
		expect(veto.evaluatedRules).toEqual([
			"holdout_regressions",
			"critical_failure_mode_increase",
			"latency_ceiling",
			"cost_ceiling",
		]);
	});
});

describe("decideAutoUtilityOutcome", () => {
	const noVeto = {
		vetoed: false as const,
		reason: null,
		evaluatedRules: [
			"holdout_regressions",
			"critical_failure_mode_increase",
			"latency_ceiling",
			"cost_ceiling",
		],
		matchedRule: null,
	};

	it("returns vetoed when a hard veto matched", () => {
		const result = decideAutoUtilityOutcome({
			utilityScore: 2,
			objectiveReductionRatio: 0.2,
			regressions: 0,
			improvements: 2,
			holdoutRegressions: 1,
			veto: {
				...noVeto,
				vetoed: true,
				reason: "holdout_regressions",
				matchedRule: "holdout_regressions",
			},
		});

		expect(result.decision).toBe("vetoed");
		expect(result.rationale[0]).toContain("holdout_regressions");
	});

	it("keeps candidates with positive utility and zero regressions", () => {
		const result = decideAutoUtilityOutcome({
			utilityScore: 0.3,
			objectiveReductionRatio: 0.25,
			regressions: 0,
			improvements: 2,
			holdoutRegressions: 0,
			veto: noVeto,
		});

		expect(result.decision).toBe("keep");
	});

	it("discards candidates that move the objective in the wrong direction", () => {
		const result = decideAutoUtilityOutcome({
			utilityScore: 0.1,
			objectiveReductionRatio: -0.2,
			regressions: 0,
			improvements: 1,
			holdoutRegressions: 0,
			veto: noVeto,
		});

		expect(result.decision).toBe("discard");
	});

	it("discards candidates when regressions outweigh improvements", () => {
		const result = decideAutoUtilityOutcome(
			{
				utilityScore: 0.05,
				objectiveReductionRatio: 0.1,
				regressions: 3,
				improvements: 1,
				holdoutRegressions: 0,
				veto: noVeto,
			},
			{ discardThreshold: -0.2 },
		);

		expect(result.decision).toBe("discard");
	});

	it("investigates candidates that are promising but ambiguous", () => {
		const result = decideAutoUtilityOutcome(
			{
				utilityScore: 0.05,
				objectiveReductionRatio: 0.1,
				regressions: 1,
				improvements: 2,
				holdoutRegressions: 0,
				veto: noVeto,
			},
			{ keepThreshold: 0.2, discardThreshold: -0.2 },
		);

		expect(result.decision).toBe("investigate");
	});

	it("investigates candidates when utility scoring is unavailable", () => {
		const result = decideAutoUtilityOutcome({
			utilityScore: null,
			objectiveReductionRatio: 0.1,
			regressions: 0,
			improvements: 1,
			holdoutRegressions: 0,
			veto: noVeto,
		});

		expect(result.decision).toBe("investigate");
	});
});
