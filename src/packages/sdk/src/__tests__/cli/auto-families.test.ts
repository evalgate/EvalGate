import { describe, expect, it } from "vitest";
import {
	BUILT_IN_FAMILIES,
	computeFamilyPriors,
	getMutationFamily,
	listMutationFamilies,
	rankMutationFamilies,
	resolveFamilyPriorityScore,
} from "../../cli/auto-families";
import {
	type AutoLedgerEntry,
	createAutoLedgerEntry,
} from "../../cli/auto-ledger";

function buildEntry(overrides: Partial<AutoLedgerEntry> = {}): AutoLedgerEntry {
	return createAutoLedgerEntry({
		experimentId: "exp-001",
		sessionId: "session-001",
		timestamp: "2026-03-10T14:00:00.000Z",
		parentExperimentId: "exp-000",
		baselineRef: "baseline",
		candidateRef: "candidate",
		targetFailureMode: "tone_mismatch",
		targetClusterId: null,
		mutationTarget: "prompts/support.md",
		mutationFamily: "few-shot-examples",
		patchSummary: "Add examples",
		patchHash: "hash-123",
		targetedSpecs: ["spec-1"],
		holdoutSpecs: [],
		utilityScore: 0.5,
		objectiveReductionRatio: 0.4,
		baselineObjectiveRate: 0.5,
		candidateObjectiveRate: 0.3,
		regressions: 0,
		improvements: 2,
		holdoutRegressions: 0,
		passRateDeltaRatio: 0.2,
		correctedPassRateDeltaRatio: 0.2,
		passRateBasis: "raw",
		latencyDeltaRatio: 0,
		costDeltaRatio: 0,
		decision: "keep",
		hardVetoReason: null,
		costUsd: 0.2,
		durationMs: 1000,
		detailsPath: ".evalgate/auto/details/exp-001.json",
		reflection: null,
		...overrides,
	});
}

describe("auto-families", () => {
	it("exposes built-in mutation families without sharing mutable references", () => {
		const families = listMutationFamilies();
		expect(families).toHaveLength(BUILT_IN_FAMILIES.length);
		expect(getMutationFamily("few-shot-examples")).toEqual(
			expect.objectContaining({
				id: "few-shot-examples",
				defaultPriority: 7,
				estimatedCost: "medium",
			}),
		);
		families[0]!.targetedFailureModes.push("mutated");
		expect(BUILT_IN_FAMILIES[0]!.targetedFailureModes).not.toContain("mutated");
		expect(getMutationFamily("missing-family")).toBeNull();
	});

	it("computes learned priors per family for the target failure mode", () => {
		const priors = computeFamilyPriors(
			[
				buildEntry({
					experimentId: "exp-001",
					mutationFamily: "few-shot-examples",
					decision: "keep",
					utilityScore: 0.6,
					timestamp: "2026-03-10T14:00:00.000Z",
				}),
				buildEntry({
					experimentId: "exp-002",
					mutationFamily: "few-shot-examples",
					decision: "discard",
					utilityScore: -0.2,
					timestamp: "2026-03-10T15:00:00.000Z",
				}),
				buildEntry({
					experimentId: "exp-003",
					mutationFamily: "instruction-order",
					decision: "vetoed",
					hardVetoReason: "latency_ceiling",
					utilityScore: null,
					timestamp: "2026-03-10T16:00:00.000Z",
				}),
				buildEntry({
					experimentId: "exp-004",
					mutationFamily: "few-shot-examples",
					decision: "investigate",
					utilityScore: null,
					timestamp: "2026-03-10T17:00:00.000Z",
				}),
				buildEntry({
					experimentId: "exp-005",
					targetFailureMode: "hallucination",
					mutationFamily: "retrieval-grounding",
					decision: "keep",
					utilityScore: 0.9,
					timestamp: "2026-03-10T18:00:00.000Z",
				}),
			],
			"tone_mismatch",
		);

		expect(priors).toEqual([
			{
				familyId: "few-shot-examples",
				failureMode: "tone_mismatch",
				attempts: 2,
				wins: 1,
				winRate: 0.5,
				avgUtilityOnWin: 0.6,
				lastAttemptedAt: "2026-03-10T15:00:00.000Z",
				vetoed: 0,
			},
			{
				familyId: "instruction-order",
				failureMode: "tone_mismatch",
				attempts: 1,
				wins: 0,
				winRate: 0,
				avgUtilityOnWin: 0,
				lastAttemptedAt: "2026-03-10T16:00:00.000Z",
				vetoed: 1,
			},
		]);
	});

	it("resolves weighted priority scores and ranks allowed families", () => {
		const priors = computeFamilyPriors(
			[
				buildEntry({
					mutationFamily: "instruction-order",
					decision: "keep",
					utilityScore: 0.3,
				}),
				buildEntry({
					experimentId: "exp-002",
					mutationFamily: "instruction-order",
					decision: "keep",
					utilityScore: 0.2,
				}),
				buildEntry({
					experimentId: "exp-003",
					mutationFamily: "few-shot-examples",
					decision: "discard",
					utilityScore: -0.1,
				}),
			],
			"tone_mismatch",
		);

		expect(resolveFamilyPriorityScore("instruction-order", priors)).toBeCloseTo(
			0.88,
		);
		expect(resolveFamilyPriorityScore("few-shot-examples", priors)).toBeCloseTo(
			0.21,
		);
		expect(resolveFamilyPriorityScore("format-lock", priors)).toBeCloseTo(0.5);
		expect(
			rankMutationFamilies(
				["few-shot-examples", "instruction-order", "format-lock"],
				priors,
			),
		).toEqual(["instruction-order", "format-lock", "few-shot-examples"]);
	});
});
