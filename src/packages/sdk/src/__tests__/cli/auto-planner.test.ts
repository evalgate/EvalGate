import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AssertionLLMConfig } from "../../assertions";
import type { ClusterMemory } from "../../cli/auto-cluster";
import { computeFamilyPriors } from "../../cli/auto-families";
import {
	type AutoLedgerEntry,
	createAutoLedgerEntry,
} from "../../cli/auto-ledger";
import { planNextIteration, selectNextFamily } from "../../cli/auto-planner";
import type { AutoReflection } from "../../cli/auto-reflection";

function buildEntry(overrides: Partial<AutoLedgerEntry> = {}): AutoLedgerEntry {
	return createAutoLedgerEntry({
		experimentId: "exp-001",
		sessionId: "session-001",
		timestamp: "2026-03-10T14:00:00.000Z",
		parentExperimentId: "exp-000",
		baselineRef: "baseline",
		candidateRef: "candidate",
		targetFailureMode: "tone_mismatch",
		targetClusterId: "cluster-tone-mismatch",
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

function buildClusterMemory(
	overrides: Partial<ClusterMemory> = {},
): ClusterMemory {
	return {
		schemaVersion: "1",
		clusterId: "cluster-tone-mismatch",
		targetFailureMode: "tone_mismatch",
		firstSeenAt: "2026-03-10T12:00:00.000Z",
		lastUpdatedAt: "2026-03-10T14:00:00.000Z",
		traceCount: 2,
		dominantPatterns: ["refund escalation"],
		bestIntervention: null,
		failedInterventions: [],
		suggestedNextFamily: null,
		resolvedAt: null,
		...overrides,
	};
}

function buildReflection(
	overrides: Partial<AutoReflection> = {},
): AutoReflection {
	return {
		schemaVersion: "1",
		experimentId: "exp-001",
		sessionId: "session-001",
		generatedAt: "2026-03-10T14:00:00.000Z",
		targetFailureMode: "tone_mismatch",
		mutationFamily: "few-shot-examples",
		decision: "discard",
		whatChanged: "Added an example block.",
		whyItLikelyHelped: null,
		whatRegressed: "Formatting regressed.",
		whatToTryNext: ["Try a shorter instruction-order reminder."],
		whatNotToRetry: ["Do not add long examples."],
		clusterId: "cluster-tone-mismatch",
		utilityScore: -0.1,
		objectiveRateBefore: 0.5,
		objectiveRateAfter: 0.45,
		regressions: 1,
		hardVetoReason: null,
		...overrides,
	};
}

describe("auto-planner", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("selects the next family using cooldown and recent repetition exclusions", () => {
		const ledgerEntries = [
			buildEntry({
				experimentId: "exp-001",
				mutationFamily: "few-shot-examples",
				decision: "discard",
				utilityScore: -0.2,
				timestamp: "2026-03-10T12:00:00.000Z",
			}),
			buildEntry({
				experimentId: "exp-002",
				mutationFamily: "instruction-order",
				decision: "keep",
				utilityScore: 0.4,
				timestamp: "2026-03-10T13:00:00.000Z",
			}),
			buildEntry({
				experimentId: "exp-003",
				mutationFamily: "instruction-order",
				decision: "keep",
				utilityScore: 0.3,
				timestamp: "2026-03-10T14:00:00.000Z",
			}),
		];
		const priors = computeFamilyPriors(ledgerEntries, "tone_mismatch");
		const clusterMemory = buildClusterMemory({
			failedInterventions: [
				{
					experimentId: "exp-001",
					mutationFamily: "few-shot-examples",
					reason: "discarded",
					hardVetoReason: null,
				},
			],
		});

		expect(
			selectNextFamily(
				["few-shot-examples", "instruction-order", "format-lock"],
				clusterMemory,
				priors,
				ledgerEntries,
			),
		).toBe("format-lock");
	});

	it("plans the next iteration with an LLM-backed patch proposal", async () => {
		const llmConfig: AssertionLLMConfig = {
			provider: "openai",
			apiKey: "sk-openai-test",
			model: "gpt-4o-mini",
		};
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify({
								patch:
									"Add a short instruction-order reminder to acknowledge the user's concern before answering.",
							}),
						},
					},
				],
			}),
			text: async () => "ok",
		});
		const proposal = await planNextIteration({
			iteration: 2,
			objective: "tone_mismatch",
			targetPath: "prompts/support.md",
			targetContent: "Base prompt text",
			allowedFamilies: ["instruction-order"],
			clusterMemory: null,
			familyPriors: [],
			ledgerEntries: [],
			recentReflections: [buildReflection()],
			hypothesis: "acknowledge user emotion first",
			forbiddenChanges: ["Do not add long few-shot examples."],
			llmConfig,
			maxTokens: 1400,
		});
		const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			RequestInit,
		];
		const body = JSON.parse(String(init.body)) as {
			model: string;
			max_tokens: number;
			messages: Array<{ role: string; content: string }>;
		};
		const candidate = proposal.candidate;

		expect(body.model).toBe("gpt-4o-mini");
		expect(body.max_tokens).toBe(1000);
		expect(body.messages[0]?.content).toContain("Return JSON only");
		expect(proposal.selectedFamily).toBe("instruction-order");
		expect(candidate).not.toBeNull();
		if (candidate === null) {
			throw new Error("expected planner candidate");
		}
		expect(candidate.id).toBe("planner-instruction-order-2");
		expect(candidate.label).toBe("instruction-order");
		expect(candidate.instruction).toContain("acknowledge the user's concern");
		expect(proposal.proposedPatch).toBe(candidate.instruction);
	});

	it("falls back to a heuristic patch when the planner LLM fails", async () => {
		const warn = vi.fn();
		(fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("network down"),
		);
		const proposal = await planNextIteration({
			iteration: 3,
			objective: "tone_mismatch",
			targetPath: "prompts/support.md",
			targetContent: "Base prompt text",
			allowedFamilies: ["instruction-order"],
			clusterMemory: null,
			familyPriors: [],
			ledgerEntries: [],
			recentReflections: [buildReflection()],
			hypothesis: "acknowledge user emotion first",
			llmConfig: {
				provider: "anthropic",
				apiKey: "sk-ant-test",
			},
			logger: { warn },
		});

		expect(warn).toHaveBeenCalledTimes(1);
		expect(proposal.selectedFamily).toBe("instruction-order");
		expect(proposal.proposedPatch).toContain("tone_mismatch");
		expect(proposal.proposedPatch).toContain("acknowledge user emotion first");
		expect(proposal.proposedPatch).toContain(
			"Try a shorter instruction-order reminder.",
		);
		expect(proposal.proposedPatch).toContain("Do not add long examples.");
	});

	it("returns cluster_exhausted when every allowed family has already failed for the cluster", async () => {
		const proposal = await planNextIteration({
			iteration: 4,
			objective: "tone_mismatch",
			targetPath: "prompts/support.md",
			targetContent: "Base prompt text",
			allowedFamilies: ["few-shot-examples", "instruction-order"],
			clusterMemory: buildClusterMemory({
				failedInterventions: [
					{
						experimentId: "exp-001",
						mutationFamily: "few-shot-examples",
						reason: "discarded",
						hardVetoReason: null,
					},
					{
						experimentId: "exp-002",
						mutationFamily: "instruction-order",
						reason: "vetoed",
						hardVetoReason: "latency_ceiling",
					},
				],
			}),
			familyPriors: [],
			ledgerEntries: [],
			recentReflections: [],
		});

		expect(proposal.selectedFamily).toBeNull();
		expect(proposal.candidate).toBeNull();
		expect(proposal.proposedPatch).toBeNull();
		expect(proposal.reason).toBe("cluster_exhausted");
	});
});
