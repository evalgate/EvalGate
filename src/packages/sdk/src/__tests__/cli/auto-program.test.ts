import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
	AutoProgramValidationError,
	extractAutoProgramYamlBlock,
	loadAutoProgramOrThrow,
	parseAutoProgramMarkdown,
	readAutoProgram,
	validateAutoProgram,
} from "../../cli/auto-program";

function buildValidProgramMarkdown(extraTopLevel = ""): string {
	return (
		`# EvalGate Auto Program


yaml
objective:
  failure_mode: tone_mismatch
mutation:
  target: prompts/support.md
  allowed_families:
    - few-shot-examples
budget:
  max_experiments: 3
utility:
  weights:
    objective_reduction_ratio: 1
    regressions: -1
hard_vetoes:
  latency_ceiling: 0.2
promotion:
  min_utility: 0.05
holdout:
  selection: deterministic
  locked_after: 1
stop_conditions:
  target_ratio: 0.1
${extraTopLevel}
`.replace("\nyaml\n", "\n```yaml\n") + "```\n"
	);
}

describe("extractAutoProgramYamlBlock", () => {
	it("extracts exactly one fenced yaml block", () => {
		const result = extractAutoProgramYamlBlock(buildValidProgramMarkdown());

		expect(result.yaml).toContain("objective:");
		expect(result.issues).toHaveLength(0);
	});

	it("returns an error when no yaml block exists", () => {
		const result = extractAutoProgramYamlBlock(
			"# Auto\n\nNo fenced yaml here\n",
		);

		expect(result.yaml).toBeNull();
		expect(result.issues[0]?.code).toBe("MISSING_YAML_BLOCK");
	});

	it("returns an error when multiple yaml blocks exist", () => {
		const markdown = ["```yaml\na: 1\n```", "text", "```yaml\nb: 2\n```"].join(
			"\n\n",
		);
		const result = extractAutoProgramYamlBlock(markdown);

		expect(result.yaml).toBeNull();
		expect(result.issues[0]?.code).toBe("MULTIPLE_YAML_BLOCKS");
	});
});

describe("parseAutoProgramMarkdown", () => {
	it("parses a valid program and preserves required fields", () => {
		const result = parseAutoProgramMarkdown(buildValidProgramMarkdown(), {
			filePath: ".evalgate/auto/program.md",
		});

		expect(result.passed).toBe(true);
		expect(result.program?.mutation.target).toBe("prompts/support.md");
		expect(result.program?.mutation.allowed_families).toEqual([
			"few-shot-examples",
		]);
	});

	it("parses adaptive_loop settings when provided", () => {
		const result = parseAutoProgramMarkdown(
			buildValidProgramMarkdown(
				[
					"adaptive_loop:",
					"  recent_reflections_limit: 4",
					"  family_retry_after_iterations: 2",
					"  cluster_resolved_threshold: 0.15",
				].join("\n"),
			),
			{ filePath: ".evalgate/auto/program.md" },
		);

		expect(result.passed).toBe(true);
		expect(result.program?.adaptive_loop).toMatchObject({
			recent_reflections_limit: 4,
			family_retry_after_iterations: 2,
			cluster_resolved_threshold: 0.15,
		});
	});

	it("fails in strict mode when an unknown top-level section exists", () => {
		const result = parseAutoProgramMarkdown(
			buildValidProgramMarkdown("surprise:\n  enabled: true\n"),
			{ filePath: ".evalgate/auto/program.md" },
		);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) => issue.code === "UNKNOWN_TOP_LEVEL_SECTION"),
		).toBe(true);
	});

	it("rejects unknown allowed_families values", () => {
		const result = validateAutoProgram({
			objective: {},
			mutation: {
				target: "prompt.md",
				allowed_families: ["unknown-family"],
			},
			budget: {},
			utility: {},
			hard_vetoes: {},
			promotion: {},
			holdout: {},
			stop_conditions: {},
		});

		expect(result.passed).toBe(false);
		expect(
			result.issues.some(
				(issue) =>
					issue.code === "UNKNOWN_MUTATION_FAMILY" &&
					issue.fieldPath === "mutation.allowed_families",
			),
		).toBe(true);
	});

	it("downgrades unknown top-level sections to warnings when strict mode is disabled", () => {
		const result = parseAutoProgramMarkdown(
			buildValidProgramMarkdown("surprise:\n  enabled: true\n"),
			{
				filePath: ".evalgate/auto/program.md",
				strictTopLevel: false,
			},
		);

		expect(result.passed).toBe(true);
		expect(
			result.issues.find((issue) => issue.code === "UNKNOWN_TOP_LEVEL_SECTION")
				?.severity,
		).toBe("warn");
	});

	it("reports malformed yaml in one pass", () => {
		const result = parseAutoProgramMarkdown(
			"```yaml\nobjective:\n  ok: true\nmutation: [\n```\n",
			{ filePath: ".evalgate/auto/program.md" },
		);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) => issue.code === "YAML_PARSE_ERROR"),
		).toBe(true);
	});
});

describe("validateAutoProgram", () => {
	it("rejects array mutation targets", () => {
		const result = validateAutoProgram({
			objective: {},
			mutation: {
				target: ["a.md"],
				allowed_families: ["append_instruction"],
			},
			budget: {},
			utility: {},
			hard_vetoes: {},
			promotion: {},
			holdout: {},
			stop_conditions: {},
		});

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) => issue.fieldPath === "mutation.target"),
		).toBe(true);
	});

	it("rejects empty allowed_families", () => {
		const result = validateAutoProgram({
			objective: {},
			mutation: {
				target: "prompt.md",
				allowed_families: [],
			},
			budget: {},
			utility: {},
			hard_vetoes: {},
			promotion: {},
			holdout: {},
			stop_conditions: {},
		});

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) => issue.code === "INVALID_ALLOWED_FAMILIES"),
		).toBe(true);
	});

	it("rejects string values for ratio and threshold fields", () => {
		const result = validateAutoProgram({
			objective: {
				target_ratio: "0.2",
			},
			mutation: {
				target: "prompt.md",
				allowed_families: ["few-shot-examples"],
			},
			budget: {},
			utility: {
				weights: {
					objective_reduction_ratio: "1.0",
				},
			},
			hard_vetoes: {
				latency_ceiling: "0.3",
			},
			promotion: {},
			holdout: {},
			stop_conditions: {},
		});

		expect(result.passed).toBe(false);
		expect(
			result.issues.filter((issue) => issue.code === "NON_NUMERIC_FIELD")
				.length,
		).toBeGreaterThanOrEqual(2);
		expect(
			result.issues.some((issue) => issue.code === "NON_NUMERIC_WEIGHT"),
		).toBe(true);
	});
});

describe("readAutoProgram and loadAutoProgramOrThrow", () => {
	it("returns a read error when the program file is missing", () => {
		const missingPath = path.join(os.tmpdir(), `missing-auto-${Date.now()}.md`);
		const result = readAutoProgram(missingPath);

		expect(result.passed).toBe(false);
		expect(result.issues[0]?.code).toBe("PROGRAM_READ_ERROR");
	});

	it("throws AutoProgramValidationError for malformed program files", () => {
		const dir = fs.mkdtempSync(
			path.join(os.tmpdir(), "evalgate-auto-program-"),
		);
		const filePath = path.join(dir, "program.md");
		fs.writeFileSync(filePath, "# Invalid\n\nno yaml\n", "utf8");

		try {
			expect(() => loadAutoProgramOrThrow(filePath)).toThrow(
				AutoProgramValidationError,
			);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
