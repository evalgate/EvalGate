import { describe, expect, it } from "vitest";
import {
	type ExecutableDAG,
	type ExecutableMetricNode,
	executeDAG,
} from "@/lib/metrics/dag-engine";
import type { MetricContext } from "@/lib/metrics/primitives";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CTX: MetricContext = {
	prompt: "What is the capital of France?",
	response: "The capital of France is Paris.",
	expectedOutput: "Paris",
	latencyMs: 800,
	costUsd: 0.003,
};

function inputNode(id: string, value = 1.0): ExecutableMetricNode {
	return { id, type: "input", label: id, inputs: [], value };
}

function metricNode(
	id: string,
	primitive: string,
	inputs: string[] = [],
	options?: Record<string, unknown>,
): ExecutableMetricNode {
	return { id, type: "metric", label: id, inputs, primitive, options };
}

function aggregatorNode(
	id: string,
	inputs: string[],
	aggregation: ExecutableMetricNode["aggregation"] = "mean",
): ExecutableMetricNode {
	return { id, type: "aggregator", label: id, inputs, aggregation };
}

function gateNode(
	id: string,
	inputs: string[],
	threshold = 0.5,
	isHardGate = true,
): ExecutableMetricNode {
	return {
		id,
		type: "gate",
		label: id,
		inputs,
		isHardGate,
		gateThreshold: threshold,
	};
}

function outputNode(
	id: string,
	inputs: string[],
	aggregation: ExecutableMetricNode["aggregation"] = "mean",
): ExecutableMetricNode {
	return { id, type: "output", label: id, inputs, aggregation };
}

// ── Simple metric + output ────────────────────────────────────────────────────

describe("executeDAG — single metric", () => {
	const dag: ExecutableDAG = [
		metricNode("m1", "contains_match"),
		outputNode("out", ["m1"]),
	];

	it("executes without throwing", () => {
		expect(() => executeDAG(dag, CTX)).not.toThrow();
	});

	it("finalScore matches metric score", () => {
		const result = executeDAG(dag, CTX);
		// "Paris" is contained in the response → should score 1
		expect(result.finalScore).toBeGreaterThan(0.5);
	});

	it("has node results for all nodes", () => {
		const result = executeDAG(dag, CTX);
		expect(result.nodes).toHaveLength(2);
	});

	it("execution order is topological (metric before output)", () => {
		const result = executeDAG(dag, CTX);
		const mIdx = result.executionOrder.indexOf("m1");
		const oIdx = result.executionOrder.indexOf("out");
		expect(mIdx).toBeLessThan(oIdx);
	});
});

// ── Multi-metric aggregation ──────────────────────────────────────────────────

describe("executeDAG — mean aggregation", () => {
	const dag: ExecutableDAG = [
		metricNode("contains", "contains_match"),
		metricNode("latency", "latency_score"),
		aggregatorNode("agg", ["contains", "latency"], "mean"),
		outputNode("out", ["agg"]),
	];

	it("aggregates multiple metrics correctly", () => {
		const result = executeDAG(dag, CTX);
		expect(result.finalScore).toBeGreaterThanOrEqual(0);
		expect(result.finalScore).toBeLessThanOrEqual(1);
	});

	it("aggregator node score is mean of inputs", () => {
		const result = executeDAG(dag, CTX);
		const containsScore = result.nodes.find(
			(n) => n.nodeId === "contains",
		)!.score;
		const latencyScore = result.nodes.find(
			(n) => n.nodeId === "latency",
		)!.score;
		const aggScore = result.nodes.find((n) => n.nodeId === "agg")!.score;
		expect(aggScore).toBeCloseTo((containsScore + latencyScore) / 2);
	});
});

describe("executeDAG — min aggregation", () => {
	const dag: ExecutableDAG = [
		metricNode("m1", "exact_match"), // "Paris" != "The capital..." → 0
		metricNode("m2", "contains_match"), // passes → 1
		aggregatorNode("agg", ["m1", "m2"], "min"),
		outputNode("out", ["agg"]),
	];

	it("min aggregation returns lowest score", () => {
		const result = executeDAG(dag, CTX);
		const aggScore = result.nodes.find((n) => n.nodeId === "agg")!.score;
		const m1 = result.nodes.find((n) => n.nodeId === "m1")!.score;
		const m2 = result.nodes.find((n) => n.nodeId === "m2")!.score;
		expect(aggScore).toBeCloseTo(Math.min(m1, m2));
	});
});

describe("executeDAG — weighted_mean aggregation", () => {
	const dag: ExecutableDAG = [
		metricNode("quality", "contains_match"),
		metricNode("perf", "latency_score"),
		{
			...aggregatorNode("agg", ["quality", "perf"], "weighted_mean"),
			weights: { quality: 3, perf: 1 },
		},
		outputNode("out", ["agg"]),
	];

	it("weighted aggregation applies weights", () => {
		const result = executeDAG(dag, CTX);
		const qualityScore = result.nodes.find(
			(n) => n.nodeId === "quality",
		)!.score;
		const perfScore = result.nodes.find((n) => n.nodeId === "perf")!.score;
		const expected = (qualityScore * 3 + perfScore * 1) / 4;
		const aggScore = result.nodes.find((n) => n.nodeId === "agg")!.score;
		expect(aggScore).toBeCloseTo(expected);
	});
});

// ── Hard gate blocking ────────────────────────────────────────────────────────

describe("executeDAG — hard gate", () => {
	it("blocks execution when gate threshold not met", () => {
		const dag: ExecutableDAG = [
			metricNode("safety", "exact_match", [], {}), // "Paris" != "The capital..." → 0
			gateNode("safety_gate", ["safety"], 0.9, true),
			metricNode("quality", "contains_match"),
			outputNode("out", ["quality"]),
		];

		const result = executeDAG(dag, CTX);
		expect(result.gatesPassed).toBe(false);
		expect(result.blockedByGate).toBe("safety_gate");
		expect(result.passed).toBe(false);
	});

	it("skips the output node when gate is in the output's dependency chain", () => {
		// output depends on gate → gate fails → output is skipped
		const dag: ExecutableDAG = [
			metricNode("safety", "exact_match"), // 0 → gate fails
			gateNode("gate", ["safety"], 0.9, true),
			outputNode("out", ["gate"]), // output depends on gate
		];

		const result = executeDAG(dag, CTX);
		const outputNodeResult = result.nodes.find((n) => n.nodeId === "out");
		// output must come after gate in topo order since it depends on gate
		expect(outputNodeResult?.skipped).toBe(true);
		expect(result.blockedByGate).toBe("gate");
	});

	it("passes when gate threshold met", () => {
		const dag: ExecutableDAG = [
			metricNode("safety", "contains_match"), // 1 → passes
			gateNode("safety_gate", ["safety"], 0.5, true),
			metricNode("quality", "contains_match"),
			outputNode("out", ["quality"]),
		];

		const result = executeDAG(dag, CTX);
		expect(result.gatesPassed).toBe(true);
		expect(result.blockedByGate).toBeNull();
	});
});

// ── Custom primitives ─────────────────────────────────────────────────────────

describe("executeDAG — custom primitives", () => {
	it("uses custom primitive when registered", () => {
		const dag: ExecutableDAG = [
			metricNode("custom", "my_custom"),
			outputNode("out", ["custom"]),
		];

		const result = executeDAG(dag, CTX, {
			customPrimitives: {
				my_custom: () => ({ score: 0.77, passed: true, label: "custom" }),
			},
		});

		expect(result.finalScore).toBeCloseTo(0.77);
	});

	it("scores 0 for unknown primitive", () => {
		const dag: ExecutableDAG = [
			metricNode("unknown", "nonexistent_metric"),
			outputNode("out", ["unknown"]),
		];

		const result = executeDAG(dag, CTX);
		const unknownNode = result.nodes.find((n) => n.nodeId === "unknown");
		expect(unknownNode?.score).toBe(0);
	});
});

// ── Input nodes ───────────────────────────────────────────────────────────────

describe("executeDAG — input nodes", () => {
	it("input node with value 0.8 contributes 0.8 to output", () => {
		const dag: ExecutableDAG = [
			inputNode("inp", 0.8),
			outputNode("out", ["inp"]),
		];

		const result = executeDAG(dag, CTX);
		expect(result.finalScore).toBeCloseTo(0.8);
	});
});

// ── Pass/fail determination ───────────────────────────────────────────────────

describe("executeDAG — pass/fail", () => {
	it("passes when finalScore >= passThreshold", () => {
		const dag: ExecutableDAG = [
			inputNode("inp", 0.9),
			outputNode("out", ["inp"]),
		];
		const result = executeDAG(dag, CTX, { passThreshold: 0.6 });
		expect(result.passed).toBe(true);
	});

	it("fails when finalScore < passThreshold", () => {
		const dag: ExecutableDAG = [
			inputNode("inp", 0.3),
			outputNode("out", ["inp"]),
		];
		const result = executeDAG(dag, CTX, { passThreshold: 0.6 });
		expect(result.passed).toBe(false);
	});
});

// ── Invalid DAG rejection ─────────────────────────────────────────────────────

describe("executeDAG — invalid DAG", () => {
	it("throws for DAG with no output node", () => {
		const dag: ExecutableDAG = [metricNode("m1", "exact_match")];
		expect(() => executeDAG(dag, CTX)).toThrow();
	});

	it("throws for empty DAG", () => {
		expect(() => executeDAG([], CTX)).toThrow();
	});
});
