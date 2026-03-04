/**
 * Tests for defineEval.fromDataset — dataset-driven spec registration
 */

import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineEval } from "../runtime/eval";
import { disposeActiveRuntime, getActiveRuntime } from "../runtime/registry";
import type { EvalContext, EvalResult } from "../runtime/types";

const fixturesDir = path.join(__dirname, "fixtures");

const dummyExecutor = async (
	ctx: EvalContext & { input: Record<string, unknown> },
): Promise<EvalResult> => ({
	pass: true,
	score: 100,
	metadata: { question: ctx.input.question },
});

describe("defineEval.fromDataset", () => {
	beforeEach(() => {
		disposeActiveRuntime();
	});

	afterEach(() => {
		disposeActiveRuntime();
	});

	it("loads JSONL and registers one spec per row", () => {
		defineEval.fromDataset(
			"qa-test",
			path.join(fixturesDir, "dataset.jsonl"),
			dummyExecutor,
		);
		const specs = getActiveRuntime().list();
		expect(specs).toHaveLength(3);
		expect(specs[0].name).toBe("qa-test - row 1");
		expect(specs[1].name).toBe("qa-test - row 2");
		expect(specs[2].name).toBe("qa-test - row 3");
	});

	it("loads CSV and registers one spec per row", () => {
		defineEval.fromDataset(
			"csv-test",
			path.join(fixturesDir, "dataset.csv"),
			dummyExecutor,
		);
		const specs = getActiveRuntime().list();
		expect(specs).toHaveLength(3);
		expect(specs[0].name).toBe("csv-test - row 1");
	});

	it("loads JSON array and registers one spec per element", () => {
		defineEval.fromDataset(
			"json-test",
			path.join(fixturesDir, "dataset.json"),
			dummyExecutor,
		);
		const specs = getActiveRuntime().list();
		expect(specs).toHaveLength(2);
		expect(specs[0].name).toBe("json-test - row 1");
	});

	it("passes row data as context.input to the executor", async () => {
		let capturedInput: Record<string, unknown> | null = null;
		defineEval.fromDataset(
			"input-test",
			path.join(fixturesDir, "dataset.jsonl"),
			async (ctx) => {
				capturedInput = ctx.input;
				return { pass: true, score: 100 };
			},
		);
		const specs = getActiveRuntime().list();
		// Execute first spec's executor manually
		await specs[0].executor({ input: "ignored", metadata: {} });
		expect(capturedInput).toEqual({ question: "What is 2+2?", expected: "4" });
	});

	it("attaches datasetPath and datasetRow metadata", () => {
		defineEval.fromDataset(
			"meta-test",
			path.join(fixturesDir, "dataset.jsonl"),
			dummyExecutor,
		);
		const specs = getActiveRuntime().list();
		expect(specs[0].metadata?.datasetRow).toBe(1);
		expect(specs[0].metadata?.datasetPath).toContain("dataset.jsonl");
		expect(specs[2].metadata?.datasetRow).toBe(3);
	});

	it("throws on missing file", () => {
		expect(() =>
			defineEval.fromDataset(
				"missing",
				"/nonexistent/file.jsonl",
				dummyExecutor,
			),
		).toThrow("Dataset file not found");
	});

	it("throws on unsupported extension", () => {
		// Use an existing file with wrong extension
		expect(() =>
			defineEval.fromDataset(
				"bad-ext",
				path.join(fixturesDir, "..", "eval-skip-only.test.ts"),
				dummyExecutor,
			),
		).toThrow("Unsupported dataset format");
	});

	it("forwards spec options to all registered specs", () => {
		defineEval.fromDataset(
			"opts-test",
			path.join(fixturesDir, "dataset.jsonl"),
			dummyExecutor,
			{ tags: ["golden"], timeout: 5000 },
		);
		const specs = getActiveRuntime().list();
		for (const spec of specs) {
			expect(spec.tags).toEqual(["golden"]);
			expect(spec.config?.timeout).toBe(5000);
		}
	});
});
