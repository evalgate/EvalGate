import { describe, expect, it } from "vitest";
import type { UnitTestExportData } from "@/lib/export-templates";
import {
	generateExportFilename,
	getExportDescription,
	getRecommendedExportFormat,
	validateExportData,
} from "@/lib/export-templates";

// ── generateExportFilename ────────────────────────────────────────────────────

describe("generateExportFilename", () => {
	it("includes type and sanitized name", () => {
		const filename = generateExportFilename("My Eval", "unit_test");
		expect(filename).toMatch(/^unit_test-my-eval-\d+\.json$/);
	});

	it("lowercases and hyphenates spaces", () => {
		const filename = generateExportFilename(
			"Customer Support Suite",
			"model_eval",
		);
		expect(filename).toContain("customer-support-suite");
	});

	it("includes category when provided", () => {
		const filename = generateExportFilename("Eval", "unit_test", "safety");
		expect(filename).toMatch(/^unit_test-safety-eval-\d+\.json$/);
	});

	it("omits category segment when not provided", () => {
		const filename = generateExportFilename("Eval", "ab_test");
		expect(filename).not.toContain("undefined");
		expect(filename).toMatch(/^ab_test-eval-\d+\.json$/);
	});

	it("ends with .json", () => {
		const filename = generateExportFilename("Test", "human_eval");
		expect(filename.endsWith(".json")).toBe(true);
	});

	it("includes a numeric timestamp", () => {
		const before = Date.now();
		const filename = generateExportFilename("Test", "unit_test");
		const after = Date.now();
		const match = filename.match(/-(\d+)\.json$/);
		expect(match).toBeTruthy();
		const ts = Number(match![1]);
		expect(ts).toBeGreaterThanOrEqual(before);
		expect(ts).toBeLessThanOrEqual(after);
	});
});

// ── getExportDescription ──────────────────────────────────────────────────────

describe("getExportDescription", () => {
	it("returns description for unit_test", () => {
		expect(getExportDescription("unit_test")).toContain("test");
	});

	it("returns description for human_eval", () => {
		expect(getExportDescription("human_eval")).toContain("Human");
	});

	it("returns description for model_eval", () => {
		expect(getExportDescription("model_eval")).toContain("LLM");
	});

	it("returns description for ab_test", () => {
		expect(getExportDescription("ab_test")).toContain("A/B");
	});

	it("returns a non-empty string for all types", () => {
		for (const type of [
			"unit_test",
			"human_eval",
			"model_eval",
			"ab_test",
		] as const) {
			expect(getExportDescription(type).length).toBeGreaterThan(0);
		}
	});
});

// ── getRecommendedExportFormat ────────────────────────────────────────────────

describe("getRecommendedExportFormat", () => {
	it("returns 'json' for all evaluation types", () => {
		for (const type of [
			"unit_test",
			"human_eval",
			"model_eval",
			"ab_test",
		] as const) {
			expect(getRecommendedExportFormat(type)).toBe("json");
		}
	});
});

// ── validateExportData ────────────────────────────────────────────────────────

function baseData() {
	return {
		evaluation: {
			id: "eval-1",
			name: "My Eval",
			type: "unit_test" as const,
			description: "",
			createdAt: "2024-01-01T00:00:00Z",
		},
		summary: {
			totalRuns: 1,
			passRate: 0.9,
			averageScore: 85,
			lastRunAt: "2024-01-01T00:00:00Z",
		},
		qualityScore: {
			score: 85,
			breakdown: {
				passRate: 90,
				safety: 80,
				judge: 85,
				schema: 90,
				latency: 95,
				cost: 80,
			},
			flags: [],
			evidenceLevel: "strong" as const,
		},
	};
}

function makeUnitTestData(
	overrides: Partial<UnitTestExportData> = {},
): UnitTestExportData {
	return {
		...baseData(),
		type: "unit_test",
		testResults: [
			{
				id: "tr-1",
				testCaseId: "tc-1",
				name: "Test 1",
				status: "passed",
				score: 90,
				output: "ok",
				durationMs: 100,
			},
		],
		codeValidation: undefined,
		...overrides,
	};
}

describe("validateExportData", () => {
	it("returns valid=true for a complete unit_test payload", () => {
		const result = validateExportData(makeUnitTestData());
		expect(result.valid).toBe(true);
		expect(result.missingFields).toHaveLength(0);
	});

	it("flags missing evaluation.id", () => {
		const data = makeUnitTestData();
		(data.evaluation as Record<string, unknown>).id = "";
		const result = validateExportData(data);
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("evaluation.id");
	});

	it("flags missing evaluation.name", () => {
		const data = makeUnitTestData();
		(data.evaluation as Record<string, unknown>).name = "";
		const result = validateExportData(data);
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("evaluation.name");
	});

	it("flags missing qualityScore", () => {
		const data = makeUnitTestData();
		(data as Record<string, unknown>).qualityScore = null;
		const result = validateExportData(data);
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("qualityScore");
	});

	it("flags missing summary", () => {
		const data = makeUnitTestData();
		(data as Record<string, unknown>).summary = null;
		const result = validateExportData(data);
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("summary");
	});

	it("flags empty testResults for unit_test", () => {
		const data = makeUnitTestData({ testResults: [] });
		const result = validateExportData(data);
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("testResults");
	});
});
