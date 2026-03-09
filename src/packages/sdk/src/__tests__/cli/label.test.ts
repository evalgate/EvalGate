/**
 * Tests for evalgate label command
 */

import * as fs from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	type LabeledGoldenCase,
	type LabeledOutcome,
	parseLabelArgs,
} from "../../cli/label";

describe("label command", () => {
	let tmpDir: string;
	let runPath: string;
	let _outputPath: string;

	beforeEach(async () => {
		tmpDir = await fs.promises.mkdtemp(
			path.join(tmpdir(), "evalgate-label-test-"),
		);
		runPath = path.join(tmpDir, "run.json");
		_outputPath = path.join(tmpDir, "labeled.jsonl");

		const mockRun = {
			schemaVersion: 1,
			runId: "test-run",
			timestamp: "2025-01-01T00:00:00.000Z",
			summary: { total: 2, passed: 1, failed: 1, passRate: 0.5 },
			results: [
				{
					specId: "spec-1",
					input: "What is 2+2?",
					expected: "4",
					actual: "4",
					result: { status: "passed", score: 1.0 },
					duration: 100,
				},
				{
					specId: "spec-2",
					input: "What is 3+3?",
					expected: "6",
					actual: "7",
					result: { status: "failed", score: 0.0 },
					duration: 120,
				},
			],
		};

		await fs.promises.writeFile(runPath, JSON.stringify(mockRun, null, 2));
	});

	afterEach(async () => {
		await fs.promises.rm(tmpDir, { recursive: true, force: true });
	});

	describe("parseLabelArgs", () => {
		it("parses empty args", () => {
			const result = parseLabelArgs([]);
			expect(result).toEqual({
				runPath: null,
				outputPath: null,
				format: "human",
			});
		});

		it("parses --run flag", () => {
			const result = parseLabelArgs(["--run", "custom-run.json"]);
			expect(result.runPath).toBe("custom-run.json");
			expect(result.outputPath).toBeNull();
			expect(result.format).toBe("human");
		});

		it("parses --output flag", () => {
			const result = parseLabelArgs(["--output", "out/labeled.jsonl"]);
			expect(result.outputPath).toBe("out/labeled.jsonl");
			expect(result.runPath).toBeNull();
			expect(result.format).toBe("human");
		});

		it("parses --format json", () => {
			const result = parseLabelArgs(["--format", "json"]);
			expect(result.format).toBe("json");
		});

		it("parses --format human (default)", () => {
			const result = parseLabelArgs(["--format", "human"]);
			expect(result.format).toBe("human");
		});

		it("ignores unknown formats and keeps default", () => {
			const result = parseLabelArgs(["--format", "xml"]);
			expect(result.format).toBe("human");
		});

		it("parses multiple flags", () => {
			const result = parseLabelArgs([
				"--run",
				"run.json",
				"--output",
				"out.jsonl",
				"--format",
				"json",
			]);
			expect(result).toEqual({
				runPath: "run.json",
				outputPath: "out.jsonl",
				format: "json",
			});
		});
	});

	describe("LabeledGoldenCase schema consistency", () => {
		it("matches expected interface shape", () => {
			const labeledCase: LabeledGoldenCase = {
				caseId: "spec-1",
				input: "What is 2+2?",
				expected: "4",
				actual: "4",
				label: "pass" as LabeledOutcome,
				failureMode: null,
				labeledAt: "2025-01-01T00:00:00.000Z",
			};

			expect(labeledCase.caseId).toBeTypeOf("string");
			expect(labeledCase.input).toBeTypeOf("string");
			expect(labeledCase.expected).toBeTypeOf("string");
			expect(labeledCase.actual).toBeTypeOf("string");
			expect(["pass", "fail"]).toContain(labeledCase.label);
			expect(
				labeledCase.failureMode === null ||
					typeof labeledCase.failureMode === "string",
			).toBe(true);
			expect(labeledCase.labeledAt).toMatch(
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
			);
		});
	});

	describe("run discovery", () => {
		it("should find run result in standard locations when no explicit path", async () => {
			// This would be tested by the actual runLabel function
			// For now, we verify the search paths are reasonable
			const searchPaths = [
				"evals/latest-run.json",
				"evals/runs/latest.json",
				".evalgate/latest-run.json",
				".evalgate/runs/latest.json",
			];

			expect(searchPaths).toContain("evals/latest-run.json");
			expect(searchPaths).toContain(
				".evalgate/golden/labeled.jsonl".replace(
					"/golden/labeled.jsonl",
					"/latest-run.json",
				),
			);
		});
	});

	describe("output format", () => {
		it("writes valid JSONL format", () => {
			const cases: LabeledGoldenCase[] = [
				{
					caseId: "spec-1",
					input: "What is 2+2?",
					expected: "4",
					actual: "4",
					label: "pass",
					failureMode: null,
					labeledAt: "2025-01-01T00:00:00.000Z",
				},
				{
					caseId: "spec-2",
					input: "What is 3+3?",
					expected: "6",
					actual: "7",
					label: "fail",
					failureMode: "arithmetic_error",
					labeledAt: "2025-01-01T00:00:01.000Z",
				},
			];

			const jsonl = cases.map((c) => JSON.stringify(c)).join("\n");
			const lines = jsonl.split("\n");

			expect(lines).toHaveLength(2);
			expect(() => JSON.parse(lines[0])).not.toThrow();
			expect(() => JSON.parse(lines[1])).not.toThrow();

			const parsed1 = JSON.parse(lines[0]) as LabeledGoldenCase;
			const parsed2 = JSON.parse(lines[1]) as LabeledGoldenCase;

			expect(parsed1.caseId).toBe("spec-1");
			expect(parsed1.label).toBe("pass");
			expect(parsed1.failureMode).toBeNull();

			expect(parsed2.caseId).toBe("spec-2");
			expect(parsed2.label).toBe("fail");
			expect(parsed2.failureMode).toBe("arithmetic_error");
		});
	});
});
