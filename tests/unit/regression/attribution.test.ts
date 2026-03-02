import { describe, expect, it } from "vitest";
import {
	attributeRegression,
	formatAttributionReport,
	type RegressionDiff,
} from "@/lib/regression/attribution";

describe("attributeRegression", () => {
	it("returns empty causes for empty diff", () => {
		const report = attributeRegression({});
		expect(report.causes).toHaveLength(0);
		expect(report.highConfidenceCauseFound).toBe(false);
		expect(report.signalsAnalyzed).toBe(0);
	});

	it("identifies prompt change as top cause", () => {
		const diff: RegressionDiff = {
			promptsChanged: true,
			changedPromptFiles: ["prompts/system.md"],
		};
		const report = attributeRegression(diff);
		expect(report.causes.length).toBeGreaterThan(0);
		expect(report.causes[0]!.type).toBe("prompt");
		expect(report.causes[0]!.rank).toBe(1);
	});

	it("identifies model change as high-confidence cause", () => {
		const diff: RegressionDiff = {
			modelChanged: true,
			modelDiff: { from: "gpt-4o", to: "gpt-4o-mini" },
		};
		const report = attributeRegression(diff);
		expect(report.causes.some((c) => c.type === "model_config")).toBe(true);
		expect(report.highConfidenceCauseFound).toBe(true);
	});

	it("ranks prompt above git_diff when both present", () => {
		const diff: RegressionDiff = {
			promptsChanged: true,
			changedPromptFiles: ["prompts/system.md"],
			changedFiles: ["src/lib/agent.ts"],
		};
		const report = attributeRegression(diff);
		const promptRank = report.causes.find((c) => c.type === "prompt")?.rank;
		const gitRank = report.causes.find((c) => c.type === "git_diff")?.rank;
		if (promptRank !== undefined && gitRank !== undefined) {
			expect(promptRank).toBeLessThan(gitRank);
		}
	});

	it("identifies judge config change", () => {
		const diff: RegressionDiff = {
			judgeConfigChanged: true,
			judgeConfigDiff: "temperature changed from 0 to 0.3",
		};
		const report = attributeRegression(diff);
		expect(report.causes.some((c) => c.type === "judge_config")).toBe(true);
	});

	it("identifies tool schema change", () => {
		const diff: RegressionDiff = {
			toolSchemaChanged: true,
			changedTools: ["search", "calculator"],
		};
		const report = attributeRegression(diff);
		expect(report.causes.some((c) => c.type === "tool_schema")).toBe(true);
		const toolCause = report.causes.find((c) => c.type === "tool_schema");
		expect(toolCause?.evidence).toContain("search");
	});

	it("identifies dataset change", () => {
		const diff: RegressionDiff = {
			datasetChanged: true,
			datasetDiff: { added: 0, removed: 5, modified: 2 },
		};
		const report = attributeRegression(diff);
		expect(report.causes.some((c) => c.type === "dataset")).toBe(true);
	});

	it("respects topN option", () => {
		const diff: RegressionDiff = {
			promptsChanged: true,
			modelChanged: true,
			modelDiff: { from: "a", to: "b" },
			judgeConfigChanged: true,
			toolSchemaChanged: true,
			datasetChanged: true,
			datasetDiff: { added: 1, removed: 0, modified: 0 },
		};
		const report = attributeRegression(diff, { topN: 2 });
		expect(report.causes.length).toBeLessThanOrEqual(2);
	});

	it("causes are ranked 1-based", () => {
		const diff: RegressionDiff = {
			promptsChanged: true,
			modelChanged: true,
			modelDiff: { from: "a", to: "b" },
		};
		const report = attributeRegression(diff);
		const ranks = report.causes.map((c) => c.rank);
		expect(ranks[0]).toBe(1);
		if (ranks.length > 1) expect(ranks[1]).toBe(2);
	});

	it("all causes have confidence between 0 and 1", () => {
		const diff: RegressionDiff = {
			promptsChanged: true,
			changedFiles: ["src/lib/agent.ts", "src/lib/tools/search.ts"],
		};
		const report = attributeRegression(diff);
		for (const cause of report.causes) {
			expect(cause.confidence).toBeGreaterThan(0);
			expect(cause.confidence).toBeLessThanOrEqual(1);
		}
	});

	it("all causes include a suggestedAction", () => {
		const diff: RegressionDiff = {
			promptsChanged: true,
			modelChanged: true,
			modelDiff: { from: "a", to: "b" },
		};
		const report = attributeRegression(diff);
		for (const cause of report.causes) {
			expect(cause.suggestedAction).toBeTruthy();
		}
	});

	it("summary is non-empty string", () => {
		const report = attributeRegression({ promptsChanged: true });
		expect(typeof report.summary).toBe("string");
		expect(report.summary.length).toBeGreaterThan(0);
	});

	it("filters git_diff to relevant files only", () => {
		const diff: RegressionDiff = {
			changedFiles: [
				"README.md",
				"package.json",
				"src/lib/agent.ts",
				"src/lib/tools/search.ts",
			],
		};
		const report = attributeRegression(diff);
		const gitCause = report.causes.find((c) => c.type === "git_diff");
		expect(gitCause).toBeDefined();
		expect(gitCause?.evidence).not.toContain("README.md");
	});

	it("ignores git_diff when no relevant files changed", () => {
		const diff: RegressionDiff = {
			changedFiles: ["README.md", "docs/guide.md", ".github/workflows/ci.yml"],
		};
		const report = attributeRegression(diff);
		expect(report.causes.some((c) => c.type === "git_diff")).toBe(false);
	});
});

describe("formatAttributionReport", () => {
	it("returns a non-empty string", () => {
		const report = attributeRegression({ promptsChanged: true });
		const formatted = formatAttributionReport(report);
		expect(formatted.length).toBeGreaterThan(0);
	});

	it("includes Regression Attribution heading", () => {
		const report = attributeRegression({ promptsChanged: true });
		const formatted = formatAttributionReport(report);
		expect(formatted).toContain("Regression Attribution");
	});

	it("includes suggested action", () => {
		const report = attributeRegression({ promptsChanged: true });
		const formatted = formatAttributionReport(report);
		expect(formatted).toContain("→");
	});

	it("handles empty causes gracefully", () => {
		const report = attributeRegression({});
		const formatted = formatAttributionReport(report);
		expect(formatted).toContain("No likely cause");
	});
});
