import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";
import {
	assertValidClusterMemory,
	buildAutoClusterId,
	type ClusterMemory,
	readClusterMemory,
	resolveAutoClusterPath,
	resolveAutoClusterRelativePath,
	updateClusterMemoryForIteration,
	writeClusterMemory,
} from "../../cli/auto-cluster";
import { computeFamilyPriors } from "../../cli/auto-families";
import {
	type AutoLedgerEntry,
	createAutoLedgerEntry,
} from "../../cli/auto-ledger";

function makeTempProjectRoot(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "evalgate-auto-cluster-"));
}

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
		utilityScore: 0.4,
		objectiveReductionRatio: 0.5,
		baselineObjectiveRate: 0.4,
		candidateObjectiveRate: 0.2,
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

describe("auto-cluster", () => {
	it("writes and reads validated cluster artifacts", () => {
		const projectRoot = makeTempProjectRoot();
		try {
			const cluster: ClusterMemory = {
				schemaVersion: "1",
				clusterId: "cluster-tone-mismatch",
				targetFailureMode: "tone_mismatch",
				firstSeenAt: "2026-03-10T14:00:00.000Z",
				lastUpdatedAt: "2026-03-10T14:30:00.000Z",
				traceCount: 2,
				dominantPatterns: ["refund escalation", "angry customer"],
				bestIntervention: {
					experimentId: "exp-001",
					mutationFamily: "few-shot-examples",
					utilityScore: 0.4,
					objectiveReduction: 0.5,
				},
				failedInterventions: [],
				suggestedNextFamily: "instruction-order",
				resolvedAt: null,
			};
			const clusterPath = resolveAutoClusterPath(
				cluster.clusterId,
				projectRoot,
			);
			writeClusterMemory(cluster, clusterPath);

			expect(
				resolveAutoClusterRelativePath(cluster.clusterId, projectRoot),
			).toBe(
				path.join(
					".evalgate",
					"auto",
					"clusters",
					"cluster-tone-mismatch.json",
				),
			);
			expect(readClusterMemory(clusterPath)).toEqual(cluster);
			expect(() =>
				assertValidClusterMemory({ ...cluster, traceCount: Number.NaN }),
			).toThrow();
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("updates best and failed interventions while computing the next family suggestion", () => {
		const projectRoot = makeTempProjectRoot();
		try {
			const toneEntries = [
				buildEntry({
					experimentId: "exp-001",
					mutationFamily: "few-shot-examples",
					decision: "discard",
					utilityScore: -0.1,
					timestamp: "2026-03-10T13:00:00.000Z",
				}),
				buildEntry({
					experimentId: "exp-002",
					mutationFamily: "instruction-order",
					decision: "keep",
					utilityScore: 0.6,
					timestamp: "2026-03-10T13:30:00.000Z",
				}),
			];
			const familyPriors = computeFamilyPriors(toneEntries, "tone_mismatch");
			const cluster = updateClusterMemoryForIteration({
				entry: buildEntry({
					experimentId: "exp-003",
					mutationFamily: "instruction-order",
					decision: "keep",
					utilityScore: 0.7,
					objectiveReductionRatio: 0.6,
					timestamp: "2026-03-10T14:00:00.000Z",
				}),
				allowedFamilies: [
					"few-shot-examples",
					"instruction-order",
					"format-lock",
				],
				familyPriors,
				projectRoot,
				observedPatterns: ["refund escalation", "angry customer"],
				resolvedThreshold: 0.25,
			});
			const saved = readClusterMemory(
				resolveAutoClusterPath(cluster.clusterId, projectRoot),
			);

			expect(cluster.clusterId).toBe(buildAutoClusterId("tone_mismatch"));
			expect(cluster.bestIntervention).toEqual({
				experimentId: "exp-003",
				mutationFamily: "instruction-order",
				utilityScore: 0.7,
				objectiveReduction: 0.6,
			});
			expect(cluster.failedInterventions).toEqual([]);
			expect(cluster.suggestedNextFamily).toBe("instruction-order");
			expect(cluster.resolvedAt).toBe("2026-03-10T14:00:00.000Z");
			expect(saved).toEqual(cluster);
			expect(cluster.dominantPatterns).toEqual([
				"refund escalation",
				"angry customer",
			]);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("records failed interventions and excludes them from the suggestion when possible", () => {
		const projectRoot = makeTempProjectRoot();
		try {
			const familyPriors = computeFamilyPriors(
				[
					buildEntry({
						experimentId: "exp-001",
						mutationFamily: "few-shot-examples",
						decision: "discard",
						utilityScore: -0.2,
					}),
					buildEntry({
						experimentId: "exp-002",
						mutationFamily: "format-lock",
						decision: "keep",
						utilityScore: 0.3,
					}),
				],
				"tone_mismatch",
			);
			const cluster = updateClusterMemoryForIteration({
				entry: buildEntry({
					experimentId: "exp-003",
					mutationFamily: "few-shot-examples",
					decision: "vetoed",
					hardVetoReason: "latency_ceiling",
					utilityScore: null,
					candidateObjectiveRate: 0.35,
				}),
				allowedFamilies: ["few-shot-examples", "format-lock"],
				familyPriors,
				projectRoot,
				observedPatterns: [
					"refund escalation",
					"refund escalation",
					"late delivery",
				],
			});

			expect(cluster.failedInterventions).toEqual([
				{
					experimentId: "exp-003",
					mutationFamily: "few-shot-examples",
					reason: "vetoed",
					hardVetoReason: "latency_ceiling",
				},
			]);
			expect(cluster.suggestedNextFamily).toBe("format-lock");
			expect(cluster.resolvedAt).toBeNull();
			expect(cluster.dominantPatterns).toEqual([
				"refund escalation",
				"late delivery",
			]);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("sets suggestedNextFamily to null when every allowed family has already failed", () => {
		const projectRoot = makeTempProjectRoot();
		try {
			const familyPriors = computeFamilyPriors([], "tone_mismatch");
			updateClusterMemoryForIteration({
				entry: buildEntry({
					experimentId: "exp-010",
					mutationFamily: "few-shot-examples",
					decision: "discard",
					utilityScore: -0.3,
				}),
				allowedFamilies: ["few-shot-examples", "instruction-order"],
				familyPriors,
				projectRoot,
			});

			const cluster = updateClusterMemoryForIteration({
				entry: buildEntry({
					experimentId: "exp-011",
					mutationFamily: "instruction-order",
					decision: "vetoed",
					hardVetoReason: "latency_ceiling",
					utilityScore: null,
				}),
				allowedFamilies: ["few-shot-examples", "instruction-order"],
				familyPriors,
				projectRoot,
			});

			expect(cluster.failedInterventions).toHaveLength(2);
			expect(cluster.suggestedNextFamily).toBeNull();
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});
});
