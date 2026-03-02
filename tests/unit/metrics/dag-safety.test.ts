import { describe, expect, it } from "vitest";
import {
	formatDAGLintReport,
	type MetricDAG,
	validateDAG,
} from "@/lib/metrics/dag-safety";

const validDAG: MetricDAG = [
	{ id: "input-1", type: "input", label: "Agent Output", inputs: [] },
	{
		id: "relevance",
		type: "metric",
		label: "Relevance Score",
		inputs: ["input-1"],
	},
	{
		id: "safety",
		type: "gate",
		label: "Safety Gate",
		inputs: ["input-1"],
		isHardGate: true,
	},
	{
		id: "finalScore",
		type: "output",
		label: "Final Score",
		inputs: ["relevance", "safety"],
	},
];

describe("validateDAG — valid cases", () => {
	it("accepts a valid DAG", () => {
		const result = validateDAG(validDAG);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("provides topological order when valid", () => {
		const result = validateDAG(validDAG);
		expect(result.topologicalOrder).toBeDefined();
		expect(result.topologicalOrder!.length).toBe(4);
	});

	it("computes max depth", () => {
		const result = validateDAG(validDAG);
		expect(result.maxDepth).toBeDefined();
		expect(result.maxDepth!).toBeGreaterThanOrEqual(1);
	});

	it("accepts output node with id finalScore", () => {
		const dag: MetricDAG = [
			{ id: "i", type: "input", label: "Input", inputs: [] },
			{ id: "finalScore", type: "output", label: "Final", inputs: ["i"] },
		];
		const result = validateDAG(dag);
		expect(result.valid).toBe(true);
	});
});

describe("validateDAG — error cases", () => {
	it("rejects empty DAG", () => {
		const result = validateDAG([]);
		expect(result.valid).toBe(false);
		expect(result.errors[0]!.code).toBe("EMPTY_DAG");
	});

	it("detects cycle", () => {
		const cyclicDAG: MetricDAG = [
			{ id: "a", type: "metric", label: "A", inputs: ["b"] },
			{ id: "b", type: "metric", label: "B", inputs: ["a"] },
			{ id: "finalScore", type: "output", label: "Final", inputs: ["a"] },
		];
		const result = validateDAG(cyclicDAG);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.code === "CYCLE_DETECTED")).toBe(true);
	});

	it("detects self-loop", () => {
		const selfLoop: MetricDAG = [
			{ id: "self", type: "metric", label: "Self", inputs: ["self"] },
			{ id: "finalScore", type: "output", label: "Final", inputs: ["self"] },
		];
		const result = validateDAG(selfLoop);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.code === "CYCLE_DETECTED")).toBe(true);
	});

	it("rejects undefined input reference", () => {
		const dag: MetricDAG = [
			{ id: "metric", type: "metric", label: "M", inputs: ["nonexistent"] },
			{ id: "finalScore", type: "output", label: "Final", inputs: ["metric"] },
		];
		const result = validateDAG(dag);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.code === "UNDEFINED_INPUT")).toBe(true);
	});

	it("rejects missing finalScore output node", () => {
		const dag: MetricDAG = [
			{ id: "input", type: "input", label: "In", inputs: [] },
			{ id: "metric", type: "metric", label: "M", inputs: ["input"] },
		];
		const result = validateDAG(dag);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.code === "MISSING_FINAL_SCORE")).toBe(
			true,
		);
	});

	it("enforces max depth", () => {
		// Build a chain deeper than maxDepth
		const dag: MetricDAG = [
			{ id: "i0", type: "input", label: "I", inputs: [] },
			{ id: "m1", type: "metric", label: "M1", inputs: ["i0"] },
			{ id: "m2", type: "metric", label: "M2", inputs: ["m1"] },
			{ id: "m3", type: "metric", label: "M3", inputs: ["m2"] },
			{ id: "finalScore", type: "output", label: "Final", inputs: ["m3"] },
		];
		const result = validateDAG(dag, { maxDepth: 2 });
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.code === "MAX_DEPTH_EXCEEDED")).toBe(
			true,
		);
	});
});

describe("validateDAG — warnings", () => {
	it("warns about unreachable nodes", () => {
		const dag: MetricDAG = [
			{ id: "used", type: "input", label: "Used", inputs: [] },
			{ id: "orphan", type: "metric", label: "Orphan", inputs: [] },
			{ id: "finalScore", type: "output", label: "Final", inputs: ["used"] },
		];
		const result = validateDAG(dag);
		expect(result.valid).toBe(true);
		expect(result.warnings.some((w) => w.includes("orphan"))).toBe(true);
	});

	it("warns about hard gate with non-gate inputs", () => {
		const dag: MetricDAG = [
			{ id: "input", type: "input", label: "In", inputs: [] },
			{ id: "metric", type: "metric", label: "M", inputs: ["input"] },
			{
				id: "gate",
				type: "gate",
				label: "Gate",
				inputs: ["metric"],
				isHardGate: true,
			},
			{ id: "finalScore", type: "output", label: "Final", inputs: ["gate"] },
		];
		const result = validateDAG(dag);
		expect(result.warnings.some((w) => w.includes("gate"))).toBe(true);
	});
});

describe("formatDAGLintReport", () => {
	it("shows valid message for valid DAG", () => {
		const result = validateDAG(validDAG);
		const report = formatDAGLintReport(result);
		expect(report).toContain("✓");
		expect(report).toContain("valid");
	});

	it("shows error count for invalid DAG", () => {
		const result = validateDAG([]);
		const report = formatDAGLintReport(result);
		expect(report).toContain("✗");
		expect(report).toContain("INVALID");
	});

	it("includes error codes", () => {
		const result = validateDAG([]);
		const report = formatDAGLintReport(result);
		expect(report).toContain("EMPTY_DAG");
	});
});
