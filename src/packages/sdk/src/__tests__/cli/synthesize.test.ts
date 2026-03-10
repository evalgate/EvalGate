import { describe, expect, it } from "vitest";
import type { LabeledGoldenCase } from "../../cli/analyze";
import {
	type DimensionMatrix,
	parseDimensionMatrix,
	parseSynthesizeArgs,
	synthesizeLabeledDataset,
} from "../../cli/synthesize";

function createLabeledRows(): LabeledGoldenCase[] {
	return [
		{
			caseId: "refund-1",
			input: "Help with a partial payment refund",
			expected: "Explain the correct refund policy",
			actual: "Denied the refund incorrectly",
			label: "fail",
			failureMode: "policy_error",
			labeledAt: "2026-03-09T10:00:00.000Z",
		},
		{
			caseId: "refund-2",
			input: "Customer asks for invoice reimbursement",
			expected: "Handle reimbursement request correctly",
			actual: "Provided the wrong reimbursement answer",
			label: "fail",
			failureMode: "policy_error",
			labeledAt: "2026-03-09T10:00:01.000Z",
		},
		{
			caseId: "tone-1",
			input: "Respond to an upset customer calmly",
			expected: "Use empathy and calm tone",
			actual: "Reply was rude and dismissive",
			label: "fail",
			failureMode: "tone_mismatch",
			labeledAt: "2026-03-09T10:00:02.000Z",
		},
		{
			caseId: "pass-1",
			input: "Say hello",
			expected: "Friendly greeting",
			actual: "Hello there",
			label: "pass",
			failureMode: null,
			labeledAt: "2026-03-09T10:00:03.000Z",
		},
	];
}

describe("parseSynthesizeArgs", () => {
	it("parses dataset, dimensions, count, modes, and output options", () => {
		const parsed = parseSynthesizeArgs([
			"--dataset",
			"labeled.jsonl",
			"--dimensions",
			"dims.json",
			"--failure-mode",
			"policy_error,tone_mismatch",
			"--count",
			"6",
			"--output",
			"synthetic.jsonl",
			"--format",
			"json",
		]);

		expect(parsed.datasetPath).toBe("labeled.jsonl");
		expect(parsed.dimensionsPath).toBe("dims.json");
		expect(parsed.failureModes).toEqual(["policy_error", "tone_mismatch"]);
		expect(parsed.count).toBe(6);
		expect(parsed.outputPath).toBe("synthetic.jsonl");
		expect(parsed.format).toBe("json");
	});
});

describe("parseDimensionMatrix", () => {
	it("accepts nested dimensions objects", () => {
		const parsed: DimensionMatrix = parseDimensionMatrix(
			JSON.stringify({
				dimensions: {
					tone: ["formal", "casual"],
					topic: ["refund", "billing"],
				},
			}),
		);

		expect(parsed.dimensions).toEqual({
			tone: ["formal", "casual"],
			topic: ["refund", "billing"],
		});
	});
});

describe("synthesizeLabeledDataset", () => {
	it("generates synthetic cases across failure modes and dimension combinations", () => {
		const summary = synthesizeLabeledDataset(createLabeledRows(), {
			dimensions: {
				tone: ["formal", "casual"],
				topic: ["refund"],
			},
			count: 4,
			outputPath: "synthetic.jsonl",
		});

		expect(summary.sourceCases).toBe(4);
		expect(summary.sourceFailures).toBe(3);
		expect(summary.generated).toBe(4);
		expect(summary.dimensionCombinationCount).toBe(2);
		expect(summary.selectedFailureModes).toEqual([
			"policy_error",
			"tone_mismatch",
		]);
		expect(summary.cases[0]?.label).toBe("fail");
		expect(summary.cases[0]?.synthetic).toBe(true);
		expect(summary.cases[0]?.failureMode).toBeTruthy();
		expect(summary.cases[0]?.input).toContain("Synthetic dimensions:");
		expect(summary.cases[0]?.sourceCaseIds.length).toBe(1);
	});

	it("filters to requested failure modes", () => {
		const summary = synthesizeLabeledDataset(createLabeledRows(), {
			failureModes: ["tone_mismatch"],
			count: 2,
			outputPath: "synthetic.jsonl",
		});

		expect(summary.selectedFailureModes).toEqual(["tone_mismatch"]);
		expect(summary.generated).toBe(2);
		expect(
			summary.cases.every((item) => item.failureMode === "tone_mismatch"),
		).toBe(true);
	});
});
