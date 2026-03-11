import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	applyPromptCandidate,
	buildAutoPlan,
	buildAutoReport,
	decideAutoExperiment,
	generatePromptCandidates,
	parseAutoArgs,
	runAuto,
} from "../../cli/auto";
import {
	buildAutoClusterId,
	readClusterMemoryById,
} from "../../cli/auto-cluster";
import {
	appendAutoLedgerEntry,
	createAutoLedgerEntry,
	readAutoExperimentDetails,
	readAutoLedgerEntries,
	resolveAutoWorkspacePaths,
} from "../../cli/auto-ledger";
import {
	readAutoReflection,
	resolveAutoReflectionPath,
} from "../../cli/auto-reflection";

function makeTempProjectRoot(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "evalgate-auto-"));
}

describe("parseAutoArgs", () => {
	it("parses objective, budget, prompt and artifact paths, and dry-run mode", () => {
		const parsed = parseAutoArgs([
			"--objective",
			"tone_mismatch",
			"--hypothesis",
			"more empathetic support prompt",
			"--prompt",
			"prompts/support.md",
			"--base",
			"baseline",
			"--head",
			"candidate.json",
			"--budget",
			"4",
			"--output",
			"auto.json",
			"--format",
			"json",
			"--dry-run",
		]);

		expect(parsed.objective).toBe("tone_mismatch");
		expect(parsed.hypothesis).toBe("more empathetic support prompt");
		expect(parsed.promptPath).toBe("prompts/support.md");
		expect(parsed.base).toBe("baseline");
		expect(parsed.head).toBe("candidate.json");
		expect(parsed.budget).toBe(4);
		expect(parsed.outputPath).toBe("auto.json");
		expect(parsed.format).toBe("json");
		expect(parsed.dryRun).toBe(true);
	});
});

describe("prompt candidate helpers", () => {
	it("generates bounded prompt candidates from objective and hypothesis", () => {
		const candidates = generatePromptCandidates(
			"tone_mismatch",
			"acknowledge user emotion first",
			3,
		);

		expect(candidates).toHaveLength(3);
		expect(candidates[0]?.instruction).toContain(
			"acknowledge user emotion first",
		);
		expect(new Set(candidates.map((candidate) => candidate.id)).size).toBe(3);
	});

	it("applies a prompt candidate by replacing prior auto blocks", () => {
		const updated = applyPromptCandidate(
			[
				"Base prompt text",
				"[EvalGate auto start: old-1 | guardrail]",
				"Old candidate instruction",
				"[EvalGate auto end]",
			].join("\n"),
			{
				id: "new-1",
				label: "objective",
				instruction: "New candidate instruction",
			},
		);

		expect(updated).toContain("Base prompt text");
		expect(updated).toContain("[EvalGate auto start: new-1 | objective]");
		expect(updated).toContain("New candidate instruction");
		expect(updated).not.toContain("Old candidate instruction");
	});
});

describe("buildAutoPlan", () => {
	it("builds a bounded iteration plan", () => {
		const plan = buildAutoPlan("tone_mismatch", 3);

		expect(plan).toHaveLength(3);
		expect(plan[0]?.action).toBe("propose_change");
		expect(plan[2]?.action).toBe("decide_keep_or_discard");
	});
});

describe("decideAutoExperiment", () => {
	it("returns plan mode when no diff is available", () => {
		const result = decideAutoExperiment({
			dryRun: true,
			objective: "tone_mismatch",
			diff: null,
		});

		expect(result.decision).toBe("plan");
		expect(result.nextActions.length).toBeGreaterThan(0);
	});

	it("keeps candidates that improve the objective without regressions", () => {
		const result = decideAutoExperiment({
			dryRun: false,
			objective: "tone_mismatch",
			diff: {
				passRateDelta: 0.05,
				scoreDelta: 0.08,
				regressions: 0,
				improvements: 2,
				added: 0,
				removed: 0,
				objectiveFailureModeDelta: -2,
			},
		});

		expect(result.decision).toBe("keep");
	});

	it("discards candidates when regressions dominate", () => {
		const result = decideAutoExperiment({
			dryRun: false,
			objective: "tone_mismatch",
			diff: {
				passRateDelta: -0.03,
				scoreDelta: -0.02,
				regressions: 3,
				improvements: 1,
				added: 0,
				removed: 0,
				objectiveFailureModeDelta: 1,
			},
		});

		expect(result.decision).toBe("discard");
	});
});

describe("buildAutoReport", () => {
	it("marks reports as dry-run when no head artifact is provided", () => {
		const report = buildAutoReport({
			options: {
				objective: "tone_mismatch",
				hypothesis: null,
				base: "baseline",
				head: null,
				promptPath: "prompts/support.md",
				budget: 2,
				format: "human",
				outputPath: "auto.json",
				dryRun: false,
			},
			executionMode: "plan",
			diff: null,
			executionBudget: {
				mode: "traces",
				limit: 100,
			},
			impactedSpecIds: ["spec-1"],
			iterations: [],
		});

		expect(report.dryRun).toBe(true);
		expect(report.decision).toBe("plan");
		expect(report.executionMode).toBe("plan");
		expect(report.promptPath).toBe("prompts/support.md");
		expect(report.impactedSpecIds).toEqual(["spec-1"]);
		expect(report.planSteps).toHaveLength(2);
	});
});

describe("runAuto subcommands", () => {
	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates the auto workspace scaffold for init", async () => {
		const projectRoot = makeTempProjectRoot();
		vi.spyOn(process, "cwd").mockReturnValue(projectRoot);

		const exitCode = await runAuto(["init"]);
		const paths = resolveAutoWorkspacePaths(projectRoot);

		expect(exitCode).toBe(0);
		expect(fs.existsSync(paths.programPath)).toBe(true);
		expect(fs.readFileSync(paths.programPath, "utf8")).toContain("```yaml");
		expect(fs.existsSync(paths.ledgerPath)).toBe(true);
	});

	it("refuses auto run when program.md is malformed", async () => {
		const projectRoot = makeTempProjectRoot();
		const paths = resolveAutoWorkspacePaths(projectRoot);
		fs.mkdirSync(path.dirname(paths.programPath), { recursive: true });
		fs.writeFileSync(paths.programPath, "not a fenced yaml program", "utf8");
		vi.spyOn(process, "cwd").mockReturnValue(projectRoot);

		const exitCode = await runAuto(["run", "--dry-run"]);
		const errorOutput = vi
			.mocked(console.error)
			.mock.calls.map((call) => call.join(" "))
			.join("\n");

		expect(exitCode).toBe(2);
		expect(errorOutput).toContain("EvalGate auto ERROR");
	});

	it("runs bounded daemon cycles through the existing auto run path", async () => {
		const projectRoot = makeTempProjectRoot();
		const paths = resolveAutoWorkspacePaths(projectRoot);
		fs.mkdirSync(path.dirname(paths.programPath), { recursive: true });
		fs.mkdirSync(path.join(projectRoot, ".evalgate"), { recursive: true });
		fs.mkdirSync(path.join(projectRoot, "prompts"), { recursive: true });
		fs.writeFileSync(
			paths.programPath,
			[
				"```yaml",
				"objective:",
				"  failure_mode: tone_mismatch",
				"mutation:",
				"  target: prompts/support.md",
				"  allowed_families:",
				"    - few-shot-examples",
				"budget:",
				"  max_experiments: 1",
				"utility:",
				"  weights:",
				"    objective_reduction_ratio: 1",
				"hard_vetoes:",
				"  latency_ceiling: 0.2",
				"promotion:",
				"  min_utility: 0.05",
				"holdout:",
				"  selection: deterministic",
				"stop_conditions:",
				"  target_ratio: 0.1",
				"```",
				"",
			].join("\n"),
			"utf8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "prompts", "support.md"),
			"Base prompt",
			"utf8",
		);
		fs.writeFileSync(
			path.join(projectRoot, ".evalgate", "manifest.json"),
			JSON.stringify(
				{
					schemaVersion: 1,
					generatedAt: 1738454400,
					project: {
						name: "test-project",
						root: ".",
						namespace: "test-project",
					},
					runtime: {
						mode: "spec",
						sdkVersion: "test",
					},
					specFiles: [
						{
							filePath: "evals/support.eval.ts",
							fileHash: "hash-1",
							specCount: 1,
						},
					],
					specs: [
						{
							id: "spec-tone-1",
							name: "support-tone",
							suitePath: ["support"],
							filePath: "evals/support.eval.ts",
							position: { line: 1, column: 1 },
							tags: ["support"],
							dependsOn: {
								prompts: ["prompts/support.md"],
								datasets: [],
								tools: [],
								code: [],
							},
						},
					],
				},
				null,
				2,
			),
			"utf8",
		);

		try {
			vi.spyOn(process, "cwd").mockReturnValue(projectRoot);
			const exitCode = await runAuto([
				"daemon",
				"--cycles",
				"2",
				"--interval-ms",
				"0",
				"--dry-run",
			]);
			const output = vi
				.mocked(console.log)
				.mock.calls.map((call) => call.join(" "))
				.join("\n");

			expect(exitCode).toBe(0);
			expect(output).toContain("EvalGate auto daemon cycle 1/2");
			expect(output).toContain("EvalGate auto daemon cycle 2/2");
			expect(output).toContain("completed 2 cycle(s) successfully");
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("renders history output from the ledger", async () => {
		const projectRoot = makeTempProjectRoot();
		const paths = resolveAutoWorkspacePaths(projectRoot);
		fs.mkdirSync(path.dirname(paths.ledgerPath), { recursive: true });
		appendAutoLedgerEntry(
			createAutoLedgerEntry({
				experimentId: "exp-001",
				sessionId: "session-001",
				timestamp: "2025-02-01T12:00:00.000Z",
				parentExperimentId: "root",
				baselineRef: "baseline.json",
				candidateRef: "candidate.json",
				targetFailureMode: "tone_mismatch",
				targetClusterId: null,
				mutationTarget: "prompts/support.md",
				mutationFamily: "append_instruction",
				patchSummary: "Add empathy preamble",
				patchHash: "patch-001",
				targetedSpecs: ["spec-1"],
				holdoutSpecs: ["spec-2"],
				utilityScore: 0.42,
				objectiveReductionRatio: 0.25,
				baselineObjectiveRate: 0.4,
				candidateObjectiveRate: 0.3,
				regressions: 0,
				improvements: 2,
				holdoutRegressions: 0,
				passRateDeltaRatio: 0.05,
				correctedPassRateDeltaRatio: 0.05,
				passRateBasis: "raw",
				latencyDeltaRatio: 0.01,
				costDeltaRatio: 0.02,
				decision: "keep",
				hardVetoReason: null,
				costUsd: 0.12,
				durationMs: 2500,
				detailsPath: ".evalgate/auto/details/exp-001.json",
				reflection: null,
			}),
			paths.ledgerPath,
		);
		vi.spyOn(process, "cwd").mockReturnValue(projectRoot);

		const exitCode = await runAuto(["history"]);
		const output = vi
			.mocked(console.log)
			.mock.calls.map((call) => call.join(" "))
			.join("\n");

		expect(exitCode).toBe(0);
		expect(output).toContain("Experiment history — target: tone_mismatch");
		expect(output).toContain("exp-001");
		expect(output).toContain("append_instruction");
	});

	it("persists ledger rows and detail artifacts from the prompt loop runner path", async () => {
		const projectRoot = makeTempProjectRoot();
		const paths = resolveAutoWorkspacePaths(projectRoot);
		fs.mkdirSync(path.dirname(paths.programPath), { recursive: true });
		fs.mkdirSync(path.join(projectRoot, ".evalgate"), { recursive: true });
		fs.mkdirSync(path.join(projectRoot, "prompts"), { recursive: true });
		fs.writeFileSync(
			paths.programPath,
			[
				"```yaml",
				"objective:",
				"  failure_mode: tone_mismatch",
				"mutation:",
				"  target: prompts/support.md",
				"  allowed_families:",
				"    - few-shot-examples",
				"budget:",
				"  max_experiments: 1",
				"utility:",
				"  weights:",
				"    objective_reduction_ratio: 1",
				"hard_vetoes:",
				"  latency_ceiling: 0.2",
				"promotion:",
				"  min_utility: 0.05",
				"holdout:",
				"  selection: deterministic",
				"stop_conditions:",
				"  target_ratio: 0.1",
				"```",
				"",
			].join("\n"),
			"utf8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "prompts", "support.md"),
			"Base prompt",
			"utf8",
		);
		fs.writeFileSync(
			path.join(projectRoot, ".evalgate", "manifest.json"),
			JSON.stringify(
				{
					schemaVersion: 1,
					generatedAt: 1738454400,
					project: {
						name: "test-project",
						root: ".",
						namespace: "test-project",
					},
					runtime: {
						mode: "spec",
						sdkVersion: "test",
					},
					specFiles: [
						{
							filePath: "evals/support.eval.ts",
							fileHash: "hash-1",
							specCount: 1,
						},
					],
					specs: [
						{
							id: "spec-tone-1",
							name: "support-tone",
							suitePath: ["support"],
							filePath: "evals/support.eval.ts",
							position: { line: 1, column: 1 },
							tags: ["support"],
							dependsOn: {
								prompts: ["prompts/support.md"],
								datasets: [],
								tools: [],
								code: [],
							},
						},
					],
				},
				null,
				2,
			),
			"utf8",
		);

		vi.spyOn(process, "cwd").mockReturnValue(projectRoot);

		const runModule = await import("../../cli/run");
		const runEvaluationsSpy = vi
			.spyOn(runModule, "runEvaluations")
			.mockResolvedValueOnce({
				schemaVersion: 1,
				runId: "run-baseline",
				metadata: {
					startedAt: 1,
					completedAt: 2,
					duration: 1000,
					totalSpecs: 1,
					executedSpecs: 1,
					mode: "spec",
				},
				results: [
					{
						specId: "spec-tone-1",
						name: "support-tone",
						filePath: "evals/support.eval.ts",
						result: {
							status: "failed",
							score: 0.4,
							duration: 100,
						},
					},
				],
				summary: {
					passed: 0,
					failed: 1,
					skipped: 0,
					passRate: 0,
					failureModes: {
						tone_mismatch: 1,
					},
					totalCostUsd: 0.2,
				},
			} as never)
			.mockResolvedValueOnce({
				schemaVersion: 1,
				runId: "run-candidate",
				metadata: {
					startedAt: 3,
					completedAt: 4,
					duration: 900,
					totalSpecs: 1,
					executedSpecs: 1,
					mode: "spec",
				},
				results: [
					{
						specId: "spec-tone-1",
						name: "support-tone",
						filePath: "evals/support.eval.ts",
						result: {
							status: "passed",
							score: 0.9,
							duration: 90,
						},
					},
				],
				summary: {
					passed: 1,
					failed: 0,
					skipped: 0,
					passRate: 1,
					failureModes: {
						tone_mismatch: 0,
					},
					totalCostUsd: 0.12,
				},
			} as never);

		try {
			const exitCode = await runAuto(["run"]);
			const ledgerEntries = readAutoLedgerEntries(paths.ledgerPath);

			expect(exitCode).toBe(0);
			expect(runEvaluationsSpy).toHaveBeenCalledTimes(2);
			expect(ledgerEntries).toHaveLength(1);
			expect(ledgerEntries[0]?.targetFailureMode).toBe("tone_mismatch");
			expect(ledgerEntries[0]?.mutationTarget).toBe("prompts/support.md");
			expect(ledgerEntries[0]?.mutationFamily).toBe("few-shot-examples");
			expect(ledgerEntries[0]?.targetedSpecs).toEqual(["spec-tone-1"]);
			expect(ledgerEntries[0]?.decision).toBe("keep");
			expect(ledgerEntries[0]?.candidateRef).toContain(".evalgate/auto/runs/");
			expect(
				fs.existsSync(path.join(projectRoot, ledgerEntries[0]!.detailsPath)),
			).toBe(true);
			expect(ledgerEntries[0]?.targetClusterId).toBe(
				buildAutoClusterId("tone_mismatch"),
			);

			const details = readAutoExperimentDetails(
				path.join(projectRoot, ledgerEntries[0]!.detailsPath),
			);
			expect(details.experimentId).toBe(ledgerEntries[0]?.experimentId);
			expect(details.mutation.target).toBe("prompts/support.md");
			expect(details.mutation.family).toBe("few-shot-examples");
			expect(details.targetedSpecSummary.failToPassIds).toEqual([
				"spec-tone-1",
			]);
			expect(details.reportPaths.candidate).toContain(".evalgate/auto/runs/");
			expect(details.reflection).toBeTruthy();

			const reflection = readAutoReflection(
				resolveAutoReflectionPath(ledgerEntries[0]!.experimentId, projectRoot),
			);
			expect(reflection.experimentId).toBe(ledgerEntries[0]?.experimentId);
			expect(reflection.mutationFamily).toBe("few-shot-examples");

			const clusterMemory = readClusterMemoryById(
				buildAutoClusterId("tone_mismatch"),
				projectRoot,
			);
			expect(clusterMemory).not.toBeNull();
			expect(clusterMemory?.traceCount).toBe(1);
			expect(clusterMemory?.bestIntervention?.experimentId).toBe(
				ledgerEntries[0]?.experimentId,
			);
			expect(clusterMemory?.bestIntervention?.mutationFamily).toBe(
				"few-shot-examples",
			);
		} finally {
			runEvaluationsSpy.mockRestore();
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("stops the prompt loop with a warning when the planner returns cluster_exhausted", async () => {
		const projectRoot = makeTempProjectRoot();
		const paths = resolveAutoWorkspacePaths(projectRoot);
		fs.mkdirSync(path.dirname(paths.programPath), { recursive: true });
		fs.mkdirSync(path.join(projectRoot, ".evalgate"), { recursive: true });
		fs.mkdirSync(path.join(projectRoot, "prompts"), { recursive: true });
		fs.writeFileSync(
			paths.programPath,
			[
				"```yaml",
				"objective:",
				"  failure_mode: tone_mismatch",
				"mutation:",
				"  target: prompts/support.md",
				"  allowed_families:",
				"    - few-shot-examples",
				"budget:",
				"  max_experiments: 1",
				"utility:",
				"  weights:",
				"    objective_reduction_ratio: 1",
				"hard_vetoes:",
				"  latency_ceiling: 0.2",
				"promotion:",
				"  min_utility: 0.05",
				"holdout:",
				"  selection: deterministic",
				"stop_conditions:",
				"  target_ratio: 0.1",
				"```",
				"",
			].join("\n"),
			"utf8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "prompts", "support.md"),
			"Base prompt",
			"utf8",
		);
		fs.writeFileSync(
			path.join(projectRoot, ".evalgate", "manifest.json"),
			JSON.stringify(
				{
					schemaVersion: 1,
					generatedAt: 1738454400,
					project: {
						name: "test-project",
						root: ".",
						namespace: "test-project",
					},
					runtime: {
						mode: "spec",
						sdkVersion: "test",
					},
					specFiles: [
						{
							filePath: "evals/support.eval.ts",
							fileHash: "hash-1",
							specCount: 1,
						},
					],
					specs: [
						{
							id: "spec-tone-1",
							name: "support-tone",
							suitePath: ["support"],
							filePath: "evals/support.eval.ts",
							position: { line: 1, column: 1 },
							tags: ["support"],
							dependsOn: {
								prompts: ["prompts/support.md"],
								datasets: [],
								tools: [],
								code: [],
							},
						},
					],
				},
				null,
				2,
			),
			"utf8",
		);

		vi.spyOn(process, "cwd").mockReturnValue(projectRoot);

		const runModule = await import("../../cli/run");
		const plannerModule = await import("../../cli/auto-planner");
		const runEvaluationsSpy = vi
			.spyOn(runModule, "runEvaluations")
			.mockResolvedValueOnce({
				schemaVersion: 1,
				runId: "run-baseline",
				metadata: {
					startedAt: 1,
					completedAt: 2,
					duration: 1000,
					totalSpecs: 1,
					executedSpecs: 1,
					mode: "spec",
				},
				results: [
					{
						specId: "spec-tone-1",
						name: "support-tone",
						filePath: "evals/support.eval.ts",
						result: {
							status: "failed",
							score: 0.4,
							duration: 100,
						},
					},
				],
				summary: {
					passed: 0,
					failed: 1,
					skipped: 0,
					passRate: 0,
					failureModes: {
						tone_mismatch: 1,
					},
					totalCostUsd: 0.2,
				},
			} as never);
		const planNextIterationSpy = vi
			.spyOn(plannerModule, "planNextIteration")
			.mockResolvedValueOnce({
				selectedFamily: null,
				candidate: null,
				proposedPatch: null,
				reason: "cluster_exhausted",
			});

		try {
			const exitCode = await runAuto(["run"]);
			const warningOutput = vi
				.mocked(console.warn)
				.mock.calls.map((call) => call.join(" "))
				.join("\n");

			expect(exitCode).toBe(0);
			expect(runEvaluationsSpy).toHaveBeenCalledTimes(1);
			expect(planNextIterationSpy).toHaveBeenCalledTimes(1);
			expect(warningOutput).toContain("cluster_exhausted");
			expect(readAutoLedgerEntries(paths.ledgerPath)).toHaveLength(0);
		} finally {
			runEvaluationsSpy.mockRestore();
			planNextIterationSpy.mockRestore();
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});
});
