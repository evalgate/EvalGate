import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeLabeledDataset, runAnalyze } from "../../cli/analyze";

describe("analyzeLabeledDataset", () => {
	it("aggregates failure modes and frequencies", () => {
		const summary = analyzeLabeledDataset(
			[
				{
					caseId: "case-1",
					input: "a",
					expected: "b",
					actual: "c",
					label: "fail",
					failureMode: "timeout",
					labeledAt: "2026-03-08T10:00:00.000Z",
				},
				{
					caseId: "case-2",
					input: "a",
					expected: "b",
					actual: "c",
					label: "fail",
					failureMode: "timeout",
					labeledAt: "2026-03-08T10:00:00.000Z",
				},
				{
					caseId: "case-3",
					input: "a",
					expected: "b",
					actual: "c",
					label: "fail",
					failureMode: "schema_mismatch",
					labeledAt: "2026-03-08T10:00:00.000Z",
				},
				{
					caseId: "case-4",
					input: "a",
					expected: "b",
					actual: "b",
					label: "pass",
					failureMode: null,
					labeledAt: "2026-03-08T10:00:00.000Z",
				},
			],
			5,
		);

		expect(summary.total).toBe(4);
		expect(summary.failed).toBe(3);
		expect(summary.failureModes[0]?.count).toBe(2);
		expect(summary.failureModes[0]?.frequency).toBeCloseTo(2 / 3, 5);
		expect(summary.failureModes[1]?.count).toBe(1);
	});
});

describe("runAnalyze", () => {
	const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
	const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

	afterEach(() => {
		logSpy.mockClear();
		errSpy.mockClear();
	});

	it("prints json summary and exits 0", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evalgate-analyze-"));
		const datasetPath = path.join(dir, "labeled.jsonl");
		fs.writeFileSync(
			datasetPath,
			[
				JSON.stringify({
					caseId: "case-1",
					input: "question",
					expected: "answer",
					actual: "bad",
					label: "fail",
					failureMode: "timeout",
					labeledAt: "2026-03-08T10:00:00.000Z",
				}),
				JSON.stringify({
					caseId: "case-2",
					input: "question",
					expected: "answer",
					actual: "answer",
					label: "pass",
					failureMode: null,
					labeledAt: "2026-03-08T10:00:00.000Z",
				}),
			].join("\n"),
			"utf8",
		);

		const code = runAnalyze(["--dataset", datasetPath, "--format", "json"]);
		expect(code).toBe(0);
		expect(logSpy).toHaveBeenCalledTimes(1);
		const out = logSpy.mock.calls[0][0] as string;
		expect(() => JSON.parse(out)).not.toThrow();
		expect(JSON.parse(out).failed).toBe(1);
	});

	it("returns non-zero when dataset path is invalid", () => {
		const code = runAnalyze(["--dataset", "does-not-exist.jsonl"]);
		expect(code).toBe(2);
		expect(errSpy).toHaveBeenCalled();
	});

	it("returns non-zero for schema-invalid dataset rows", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evalgate-analyze-"));
		const datasetPath = path.join(dir, "labeled.jsonl");
		fs.writeFileSync(
			datasetPath,
			JSON.stringify({
				caseId: "case-1",
				input: "question",
				expected: "answer",
				actual: "wrong",
				label: "fail",
				failureMode: null,
				labeledAt: "2026-03-08T10:00:00.000Z",
			}),
			"utf8",
		);

		const code = runAnalyze(["--dataset", datasetPath]);
		expect(code).toBe(2);
		expect(errSpy).toHaveBeenCalled();
	});
});
