import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";
import {
	buildAutoHistoryRows,
	filterAutoHistoryEntries,
	formatAutoExperimentInspect,
	formatAutoHistory,
	inspectAutoExperiment,
	readAutoHistory,
	sortAutoHistoryEntries,
	summarizeAutoHistory,
} from "../../cli/auto-history";
import {
	type AutoExperimentDetails,
	type AutoLedgerEntry,
	appendAutoLedgerEntry,
	createAutoLedgerEntry,
	resolveAutoDetailsPath,
	resolveAutoDetailsRelativePath,
	resolveAutoWorkspacePaths,
	writeAutoExperimentDetails,
} from "../../cli/auto-ledger";

function makeTempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "evalgate-auto-history-"));
}

function buildEntry(
	projectRoot: string,
	overrides: Partial<AutoLedgerEntry> = {},
): AutoLedgerEntry {
	return createAutoLedgerEntry({
		experimentId: "exp-001",
		sessionId: "session-001",
		timestamp: "2025-01-02T03:04:05.000Z",
		parentExperimentId: "exp-000",
		baselineRef: "baseline",
		candidateRef: "candidate",
		targetFailureMode: "tone_mismatch",
		targetClusterId: null,
		mutationTarget: "prompts/support.md",
		mutationFamily: "append_instruction",
		patchSummary: "Add escalation guidance",
		patchHash: "hash-123",
		targetedSpecs: ["spec-a", "spec-b"],
		holdoutSpecs: ["spec-h1"],
		utilityScore: 0.12,
		objectiveReductionRatio: 0.2,
		baselineObjectiveRate: 0.5,
		candidateObjectiveRate: 0.3,
		regressions: 1,
		improvements: 3,
		holdoutRegressions: 0,
		passRateDeltaRatio: 0.1,
		correctedPassRateDeltaRatio: 0.08,
		passRateBasis: "corrected",
		latencyDeltaRatio: 0.02,
		costDeltaRatio: 0.01,
		decision: "keep",
		hardVetoReason: null,
		costUsd: 1.23,
		durationMs: 4567,
		detailsPath: resolveAutoDetailsRelativePath("exp-001", projectRoot),
		reflection: "Promising improvement with no holdout regressions.",
		...overrides,
	});
}

function buildDetails(
	overrides: Partial<AutoExperimentDetails> = {},
): AutoExperimentDetails {
	return {
		experimentId: "exp-001",
		sessionId: "session-001",
		baselineRef: "baseline",
		candidateRef: "candidate",
		mutation: {
			target: "prompts/support.md",
			family: "append_instruction",
			summary: "Add escalation guidance",
		},
		utility: {
			inputMetrics: {
				objectiveReductionRatio: 0.2,
				regressions: 1,
			},
			weights: {
				objectiveReductionRatio: 1,
				regressions: -1,
			},
			computedScore: 0.12,
		},
		veto: {
			evaluatedRules: ["holdout_regressions", "latency_ceiling"],
			matchedRule: null,
		},
		targetedSpecSummary: {
			passToFailIds: ["spec-a"],
			failToPassIds: ["spec-b"],
			unchangedIds: ["spec-c"],
		},
		holdoutSpecSummary: {
			passToFailIds: [],
			failToPassIds: [],
			unchangedIds: ["spec-h1"],
		},
		anomalies: {
			latencySpikes: [],
			unexpectedFlips: [],
			missingFailureModeMapping: [],
		},
		reportPaths: {
			baseline: ".evalgate/runs/baseline.json",
			candidate: ".evalgate/auto/runs/candidate.json",
			targeted: ".evalgate/auto/runs/targeted.json",
			holdout: ".evalgate/auto/runs/holdout.json",
		},
		reflection: null,
		...overrides,
	};
}

function writeProgram(projectRoot: string, budgetLines: string[] = []): void {
	const paths = resolveAutoWorkspacePaths(projectRoot);
	fs.mkdirSync(path.dirname(paths.programPath), { recursive: true });
	fs.writeFileSync(
		paths.programPath,
		[
			"```yaml",
			"objective:",
			"  failure_mode: tone_mismatch",
			"mutation:",
			"  target: prompts/support.md",
			"  allowed_families:",
			"    - instruction-order",
			"budget:",
			...(budgetLines.length > 0
				? budgetLines
				: ["  max_experiments: 5", "  max_cost_usd: 3"]),
			"utility:",
			"  weights:",
			"    objective_reduction_ratio: 1",
			"    regressions: -1",
			"hard_vetoes:",
			"  latency_ceiling: 0.2",
			"promotion:",
			"  min_utility: 0.05",
			"holdout:",
			"  selection: deterministic",
			"  locked_after: 1",
			"stop_conditions:",
			"  target_ratio: 0.1",
			"```",
			"",
		].join("\n"),
		"utf8",
	);
}

describe("auto-history", () => {
	it("filters and sorts history entries", () => {
		const projectRoot = makeTempDir();
		try {
			const entries = [
				buildEntry(projectRoot, {
					experimentId: "exp-002",
					decision: "discard",
					utilityScore: -0.1,
					timestamp: "2025-01-03T03:04:05.000Z",
					mutationFamily: "rewrite",
				}),
				buildEntry(projectRoot, {
					experimentId: "exp-001",
					decision: "keep",
					utilityScore: 0.2,
					timestamp: "2025-01-01T03:04:05.000Z",
				}),
				buildEntry(projectRoot, {
					experimentId: "exp-003",
					decision: "keep",
					utilityScore: 0.5,
					timestamp: "2025-01-02T03:04:05.000Z",
					mutationFamily: "rewrite",
				}),
			];

			const sorted = sortAutoHistoryEntries(entries, {
				by: "utility",
				direction: "desc",
			});
			expect(sorted.map((entry) => entry.experimentId)).toEqual([
				"exp-003",
				"exp-001",
				"exp-002",
			]);

			const filtered = filterAutoHistoryEntries(sorted, {
				decision: "keep",
				mutationFamily: "rewrite",
			});
			expect(filtered.map((entry) => entry.experimentId)).toEqual(["exp-003"]);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("builds rows and summarizes history", () => {
		const projectRoot = makeTempDir();
		try {
			writeProgram(projectRoot);
			const entries = [
				buildEntry(projectRoot, {
					experimentId: "exp-001",
					decision: "keep",
					utilityScore: 0.2,
					mutationFamily: "constraint-clarification",
				}),
				buildEntry(projectRoot, {
					experimentId: "exp-002",
					decision: "discard",
					utilityScore: 0.05,
					mutationFamily: "constraint-clarification",
				}),
				buildEntry(projectRoot, {
					experimentId: "exp-003",
					decision: "vetoed",
					utilityScore: null,
					hardVetoReason: "holdout_regressions",
					mutationFamily: "instruction-order",
				}),
				buildEntry(projectRoot, {
					experimentId: "exp-004",
					decision: "investigate",
					utilityScore: null,
					mutationFamily: "constraint-clarification",
				}),
			];

			const rows = buildAutoHistoryRows(entries);
			expect(rows).toHaveLength(4);
			expect(rows[0]?.experimentId).toBe("exp-001");

			const summary = summarizeAutoHistory(entries, { projectRoot });
			expect(summary.total).toBe(4);
			expect(summary.kept).toBe(1);
			expect(summary.vetoed).toBe(1);
			expect(summary.bestUtilityScore).toBe(0.2);
			expect(summary.familyWinRates).toEqual([
				{
					mutationFamily: "constraint-clarification",
					wins: 1,
					attempts: 2,
					winRate: 0.5,
				},
				{
					mutationFamily: "instruction-order",
					wins: 0,
					attempts: 1,
					winRate: 0,
				},
			]);
			expect(summary.vetoReasons).toEqual([
				{ reason: "holdout_regressions", count: 1 },
			]);
			expect(summary.budget.iterationLimit).toBe(5);
			expect(summary.budget.costLimitUsd).toBe(3);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("reads history from the ledger and formats a human summary", () => {
		const projectRoot = makeTempDir();
		try {
			const paths = resolveAutoWorkspacePaths(projectRoot);
			writeProgram(projectRoot);
			appendAutoLedgerEntry(
				buildEntry(projectRoot, {
					experimentId: "exp_b7d4e1",
					decision: "keep",
					utilityScore: 73,
					timestamp: "2025-01-03T03:04:05.000Z",
					mutationFamily: "constraint-clarification",
					baselineObjectiveRate: 0.112,
					candidateObjectiveRate: 0.07,
					regressions: 0,
					costUsd: 0.41,
				}),
				paths.ledgerPath,
			);
			appendAutoLedgerEntry(
				buildEntry(projectRoot, {
					experimentId: "exp_c9f2a3",
					decision: "keep",
					utilityScore: 41,
					timestamp: "2025-01-02T03:04:05.000Z",
					mutationFamily: "few-shot-examples",
					baselineObjectiveRate: 0.091,
					candidateObjectiveRate: 0.07,
					regressions: 0,
					costUsd: 0.36,
				}),
				paths.ledgerPath,
			);
			appendAutoLedgerEntry(
				buildEntry(projectRoot, {
					experimentId: "exp_d1b8c4",
					decision: "discard",
					utilityScore: 18,
					timestamp: "2025-01-01T03:04:05.000Z",
					mutationFamily: "constraint-clarification",
					baselineObjectiveRate: 0.079,
					candidateObjectiveRate: 0.07,
					regressions: 0,
					costUsd: 0.33,
				}),
				paths.ledgerPath,
			);
			appendAutoLedgerEntry(
				buildEntry(projectRoot, {
					experimentId: "exp_a3f1c2",
					decision: "vetoed",
					utilityScore: -12,
					timestamp: "2025-01-04T03:04:05.000Z",
					mutationFamily: "instruction-order",
					baselineObjectiveRate: 0.07,
					candidateObjectiveRate: 0.078,
					regressions: 0,
					holdoutRegressions: 2,
					hardVetoReason: "holdout_regression",
					costUsd: 0.32,
				}),
				paths.ledgerPath,
			);

			const history = readAutoHistory(
				projectRoot,
				{ limit: 2 },
				{ by: "timestamp", direction: "desc" },
			);
			expect(history.map((entry) => entry.experimentId)).toEqual([
				"exp_a3f1c2",
				"exp_b7d4e1",
			]);

			const allHistory = readAutoHistory(
				projectRoot,
				{ limit: 4 },
				{ by: "timestamp", direction: "desc" },
			);

			const formatted = formatAutoHistory(allHistory, { projectRoot });
			expect(formatted).toContain("Experiment history — target: tone_mismatch");
			expect(formatted).toContain("exp_a3f1c2");
			expect(formatted).toContain("vetoed");
			expect(formatted).toContain("2 (holdout)");
			expect(formatted).toContain(
				"Best so far: exp_b7d4e1 (utility: 73, tone_mismatch: 11.2% → 7.0%)",
			);
			expect(formatted).toContain(
				"Budget used: $1.42 / $3.00 · 4/5 iterations",
			);
			expect(formatted).toContain("Remaining: 1 iteration · $1.58");
			expect(formatted).toContain("constraint-clarification");
			expect(formatted).toContain("1/2  (50%)");
			expect(formatted).toContain("few-shot-examples");
			expect(formatted).toContain("1/1  (100%)");
			expect(formatted).toContain("instruction-order");
			expect(formatted).toContain("0/1  (0%)");
			expect(formatted).toContain("Top veto reasons:");
			expect(formatted).toContain("holdout_regression");
			expect(formatted).toContain("×1");
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("inspects an experiment and loads its detail artifact", () => {
		const projectRoot = makeTempDir();
		try {
			const paths = resolveAutoWorkspacePaths(projectRoot);
			appendAutoLedgerEntry(buildEntry(projectRoot), paths.ledgerPath);
			writeAutoExperimentDetails(
				buildDetails(),
				resolveAutoDetailsPath("exp-001", projectRoot),
			);

			const result = inspectAutoExperiment("exp-001", projectRoot);
			expect(result.entry.experimentId).toBe("exp-001");
			expect(result.details?.utility.computedScore).toBe(0.12);
			expect(result.absoluteDetailsPath).toBe(
				path.join(projectRoot, ".evalgate", "auto", "details", "exp-001.json"),
			);

			const formatted = formatAutoExperimentInspect(result);
			expect(formatted).toContain("Experiment exp-001");
			expect(formatted).toContain("Decision: keep");
			expect(formatted).toContain("Targeted flips: +1 / -1");
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("returns null details when the linked detail artifact is missing", () => {
		const projectRoot = makeTempDir();
		try {
			const paths = resolveAutoWorkspacePaths(projectRoot);
			appendAutoLedgerEntry(buildEntry(projectRoot), paths.ledgerPath);

			const result = inspectAutoExperiment("exp-001", projectRoot);
			expect(result.details).toBeNull();
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});
});
