/**
 * Metric DAG Engine — execute a validated MetricDAG against a trace context.
 *
 * Executes nodes in topological order, propagating computed values through
 * the graph. Supports metric primitives, aggregators (mean/min/max/weighted),
 * gate nodes (hard-fail if below threshold), and output nodes.
 *
 * Requires a valid DAG (run validateDAG from dag-safety.ts first).
 */

import type { MetricNode } from "./dag-safety";
import { validateDAG } from "./dag-safety";
import type { MetricContext, PrimitiveFn, PrimitiveResult } from "./primitives";
import { PRIMITIVE_REGISTRY } from "./primitives";

// ── Types ────────────────────────────────────────────────────────────────────

/** Extended node definition used by the engine (superset of MetricNode) */
export interface ExecutableMetricNode extends MetricNode {
	/** Primitive name (for "metric" type nodes) */
	primitive?: string;
	/** Primitive options passed through */
	options?: Record<string, unknown>;
	/** Aggregation strategy (for "aggregator" type nodes) */
	aggregation?: "mean" | "min" | "max" | "weighted_mean" | "product";
	/** Per-input weights for weighted_mean (keyed by input node ID) */
	weights?: Record<string, number>;
	/** Hard gate threshold — if output < threshold, gate blocks (default: 0.5) */
	gateThreshold?: number;
	/** Fixed value override for input nodes */
	value?: number;
}

export type ExecutableDAG = ExecutableMetricNode[];

/** Result for a single node execution */
export interface NodeExecutionResult {
	nodeId: string;
	nodeType: ExecutableMetricNode["type"];
	label: string;
	score: number;
	passed: boolean;
	/** Whether this gate node blocked execution */
	gateBlocked: boolean;
	/** Source primitive details (if applicable) */
	primitiveResult?: PrimitiveResult;
	/** Whether this node was skipped due to a blocked gate upstream */
	skipped: boolean;
}

/** Full DAG execution result */
export interface DAGExecutionResult {
	/** Overall final score (from the output node) */
	finalScore: number;
	/** Whether all gates passed */
	gatesPassed: boolean;
	/** Which gate node blocked execution (if any) */
	blockedByGate: string | null;
	/** Per-node results in execution order */
	nodes: NodeExecutionResult[];
	/** Topological execution order */
	executionOrder: string[];
	/** Whether the overall evaluation passed */
	passed: boolean;
}

export interface DAGEngineConfig {
	/** Global pass threshold (default: 0.6) */
	passThreshold?: number;
	/** Custom primitive functions (merged with built-in registry) */
	customPrimitives?: Record<string, PrimitiveFn>;
}

// ── Aggregation helpers ───────────────────────────────────────────────────────

function aggregate(
	scores: number[],
	strategy: ExecutableMetricNode["aggregation"],
	weights?: Record<string, number>,
	inputIds?: string[],
): number {
	if (scores.length === 0) return 0;

	switch (strategy) {
		case "min":
			return Math.min(...scores);
		case "max":
			return Math.max(...scores);
		case "product":
			return scores.reduce((a, b) => a * b, 1);
		case "weighted_mean": {
			if (!weights || !inputIds)
				return scores.reduce((a, b) => a + b, 0) / scores.length;
			let weightedSum = 0;
			let totalWeight = 0;
			for (let i = 0; i < inputIds.length; i++) {
				const w = weights[inputIds[i]!] ?? 1;
				weightedSum += (scores[i] ?? 0) * w;
				totalWeight += w;
			}
			return totalWeight > 0 ? weightedSum / totalWeight : 0;
		}
		default:
			return scores.reduce((a, b) => a + b, 0) / scores.length;
	}
}

// ── Engine ────────────────────────────────────────────────────────────────────

/**
 * Execute a metric DAG against the provided context.
 *
 * The DAG must be valid (pass validateDAG) before calling this.
 * Returns per-node results and an overall final score.
 */
export function executeDAG(
	dag: ExecutableDAG,
	context: MetricContext,
	config: DAGEngineConfig = {},
): DAGExecutionResult {
	const { passThreshold = 0.6, customPrimitives = {} } = config;
	const registry: Record<string, PrimitiveFn> = {
		...PRIMITIVE_REGISTRY,
		...customPrimitives,
	};

	// Validate first
	const validation = validateDAG(dag);
	if (!validation.valid || !validation.topologicalOrder) {
		throw new Error(
			`Cannot execute invalid DAG: ${validation.errors.map((e) => e.message).join("; ")}`,
		);
	}

	const order = validation.topologicalOrder;
	const nodeMap = new Map(dag.map((n) => [n.id, n]));
	const scores = new Map<string, number>();
	const nodeResults: NodeExecutionResult[] = [];
	let blockedByGate: string | null = null;
	let gatesPassed = true;

	for (const nodeId of order) {
		const node = nodeMap.get(nodeId) as ExecutableMetricNode | undefined;
		if (!node) continue;

		// If a gate already blocked, skip remaining nodes
		if (blockedByGate !== null) {
			nodeResults.push({
				nodeId,
				nodeType: node.type,
				label: node.label,
				score: 0,
				passed: false,
				gateBlocked: false,
				skipped: true,
			});
			continue;
		}

		let score = 0;
		let passed = false;
		let gateBlocked = false;
		let primitiveResult: PrimitiveResult | undefined;

		switch (node.type) {
			case "input": {
				// Input nodes carry a fixed value (injected context or override)
				score = typeof node.value === "number" ? node.value : 1.0;
				passed = true;
				break;
			}

			case "metric": {
				const primitiveName = node.primitive;
				const fn = primitiveName ? registry[primitiveName] : undefined;

				if (!fn) {
					score = 0;
					passed = false;
					primitiveResult = {
						score: 0,
						passed: false,
						label: primitiveName
							? `Unknown primitive: ${primitiveName}`
							: "No primitive specified",
					};
				} else {
					primitiveResult = fn(context, node.options ?? {});
					score = primitiveResult.score;
					passed = primitiveResult.passed;
				}
				break;
			}

			case "aggregator": {
				const inputScores = node.inputs.map((id) => scores.get(id) ?? 0);
				score = aggregate(
					inputScores,
					node.aggregation ?? "mean",
					node.weights,
					node.inputs,
				);
				passed = score >= passThreshold;
				break;
			}

			case "gate": {
				const inputScores = node.inputs.map((id) => scores.get(id) ?? 0);
				score = aggregate(inputScores, "mean");
				const threshold = node.gateThreshold ?? 0.5;
				passed = score >= threshold;

				if (node.isHardGate && !passed) {
					gateBlocked = true;
					gatesPassed = false;
					blockedByGate = nodeId;
				}
				break;
			}

			case "output": {
				const inputScores = node.inputs.map((id) => scores.get(id) ?? 0);
				score = aggregate(
					inputScores,
					node.aggregation ?? "mean",
					node.weights,
					node.inputs,
				);
				passed = score >= passThreshold;
				break;
			}
		}

		scores.set(nodeId, score);
		nodeResults.push({
			nodeId,
			nodeType: node.type,
			label: node.label,
			score,
			passed,
			gateBlocked,
			primitiveResult,
			skipped: false,
		});
	}

	// Final score comes from the output node
	const outputNode = dag.find((n) => n.type === "output");
	const finalScore = outputNode ? (scores.get(outputNode.id) ?? 0) : 0;
	const overallPassed = gatesPassed && finalScore >= passThreshold;

	return {
		finalScore,
		gatesPassed,
		blockedByGate,
		nodes: nodeResults,
		executionOrder: order,
		passed: overallPassed,
	};
}
