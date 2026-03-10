import { describe, expect, it } from "vitest";

import {
	applyPromptCandidate,
	buildAutoPlan,
	buildAutoReport,
	decideAutoExperiment,
	generatePromptCandidates,
	parseAutoArgs,
} from "../../cli/auto";

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
