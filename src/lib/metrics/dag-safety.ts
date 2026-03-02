/**
 * Metric DAG Safety — Validate DAG structure before saving or execution.
 *
 * Constraints enforced:
 *   1. No cycles
 *   2. Requires a `finalScore` output node
 *   3. No undefined inputs (all edges reference existing nodes)
 *   4. Hard gate nodes must have no incoming edges from non-gate nodes
 *   5. Max depth configurable (default: 10)
 *   6. Warns if any node has no path to an output node (unreachable nodes)
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface MetricNode {
	/** Unique node ID */
	id: string;
	/** Node type */
	type: "input" | "metric" | "aggregator" | "gate" | "output";
	/** Human-readable label */
	label: string;
	/** Input edge IDs (source node IDs) */
	inputs: string[];
	/** Whether this is a hard gate (failure blocks evaluation) */
	isHardGate?: boolean;
}

export type MetricDAG = MetricNode[];

export interface DAGValidationError {
	code:
		| "CYCLE_DETECTED"
		| "MISSING_FINAL_SCORE"
		| "UNDEFINED_INPUT"
		| "MAX_DEPTH_EXCEEDED"
		| "UNREACHABLE_NODE"
		| "HARD_GATE_ORDERING"
		| "EMPTY_DAG";
	message: string;
	nodeId?: string;
}

export interface DAGValidationResult {
	valid: boolean;
	errors: DAGValidationError[];
	warnings: string[];
	/** Topological order (only present if valid) */
	topologicalOrder?: string[];
	/** Computed max depth (only present if valid) */
	maxDepth?: number;
}

// ── Cycle detection (DFS) ─────────────────────────────────────────────────────

function detectCycles(nodes: Map<string, MetricNode>): string[] | null {
	const WHITE = 0,
		GRAY = 1,
		BLACK = 2;
	const colors = new Map<string, number>();
	for (const id of nodes.keys()) colors.set(id, WHITE);

	const cycleNodes: string[] = [];

	function dfs(nodeId: string): boolean {
		colors.set(nodeId, GRAY);
		const node = nodes.get(nodeId);
		if (!node) return false;

		for (const input of node.inputs) {
			if (!nodes.has(input)) continue; // undefined input caught separately
			const color = colors.get(input);
			if (color === GRAY) {
				cycleNodes.push(input, nodeId);
				return true; // back edge = cycle
			}
			if (color === WHITE && dfs(input)) {
				return true;
			}
		}
		colors.set(nodeId, BLACK);
		return false;
	}

	for (const id of nodes.keys()) {
		if (colors.get(id) === WHITE && dfs(id)) {
			return cycleNodes;
		}
	}

	return null;
}

// ── Topological sort (Kahn's algorithm) ──────────────────────────────────────

function topologicalSort(nodes: Map<string, MetricNode>): string[] | null {
	const inDegree = new Map<string, number>();
	const adj = new Map<string, string[]>(); // node → nodes that depend on it

	for (const id of nodes.keys()) {
		inDegree.set(id, 0);
		adj.set(id, []);
	}

	for (const [id, node] of nodes) {
		for (const input of node.inputs) {
			if (!nodes.has(input)) continue;
			adj.get(input)!.push(id);
			inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
		}
	}

	const queue: string[] = [];
	for (const [id, deg] of inDegree) {
		if (deg === 0) queue.push(id);
	}

	const order: string[] = [];
	while (queue.length > 0) {
		const current = queue.shift()!;
		order.push(current);
		for (const next of adj.get(current) ?? []) {
			const newDeg = (inDegree.get(next) ?? 0) - 1;
			inDegree.set(next, newDeg);
			if (newDeg === 0) queue.push(next);
		}
	}

	return order.length === nodes.size ? order : null; // null = cycle exists
}

// ── Depth computation ─────────────────────────────────────────────────────────

function computeMaxDepth(
	nodes: Map<string, MetricNode>,
	order: string[],
): number {
	const depths = new Map<string, number>();
	for (const id of order) {
		const node = nodes.get(id)!;
		const inputDepths = node.inputs
			.filter((i) => nodes.has(i))
			.map((i) => depths.get(i) ?? 0);
		depths.set(id, inputDepths.length > 0 ? Math.max(...inputDepths) + 1 : 0);
	}
	return Math.max(0, ...Array.from(depths.values()));
}

// ── Core validator ────────────────────────────────────────────────────────────

/**
 * Validate a metric DAG definition.
 *
 * @param dag - Array of metric nodes
 * @param options - Validation options
 */
export function validateDAG(
	dag: MetricDAG,
	options: { maxDepth?: number } = {},
): DAGValidationResult {
	const maxDepthLimit = options.maxDepth ?? 10;
	const errors: DAGValidationError[] = [];
	const warnings: string[] = [];

	// 1. Empty DAG
	if (dag.length === 0) {
		return {
			valid: false,
			errors: [
				{ code: "EMPTY_DAG", message: "DAG must contain at least one node" },
			],
			warnings: [],
		};
	}

	const nodeMap = new Map<string, MetricNode>(dag.map((n) => [n.id, n]));

	// 2. Undefined inputs
	for (const node of dag) {
		for (const input of node.inputs) {
			if (!nodeMap.has(input)) {
				errors.push({
					code: "UNDEFINED_INPUT",
					message: `Node "${node.id}" references undefined input node "${input}"`,
					nodeId: node.id,
				});
			}
		}
	}

	// 3. Cycle detection
	const cycleNodes = detectCycles(nodeMap);
	if (cycleNodes) {
		errors.push({
			code: "CYCLE_DETECTED",
			message: `Cycle detected involving nodes: ${cycleNodes.join(" → ")}`,
		});
	}

	// Stop here if cycles or undefined inputs — further checks won't be reliable
	if (errors.length > 0) {
		return { valid: false, errors, warnings };
	}

	// 4. Topological sort (now guaranteed to succeed — no cycles)
	const order = topologicalSort(nodeMap)!;

	// 5. Required finalScore output node
	const hasOutputNode = dag.some(
		(n) => n.type === "output" || n.id === "finalScore",
	);
	if (!hasOutputNode) {
		errors.push({
			code: "MISSING_FINAL_SCORE",
			message: "DAG must contain a node with type 'output' or id 'finalScore'",
		});
	}

	// 6. Max depth
	const depth = computeMaxDepth(nodeMap, order);
	if (depth > maxDepthLimit) {
		errors.push({
			code: "MAX_DEPTH_EXCEEDED",
			message: `DAG depth ${depth} exceeds maximum allowed depth ${maxDepthLimit}`,
		});
	}

	// 7. Unreachable nodes (nodes with no path to any output node)
	const outputIds = new Set(
		dag.filter((n) => n.type === "output").map((n) => n.id),
	);
	if (dag.some((n) => n.id === "finalScore")) outputIds.add("finalScore");

	if (outputIds.size > 0) {
		// BFS backward from outputs
		const reachable = new Set<string>(outputIds);
		const queue = [...outputIds];
		while (queue.length > 0) {
			const current = queue.shift()!;
			const node = nodeMap.get(current);
			if (!node) continue;
			for (const input of node.inputs) {
				if (!reachable.has(input) && nodeMap.has(input)) {
					reachable.add(input);
					queue.push(input);
				}
			}
		}
		for (const node of dag) {
			if (!reachable.has(node.id)) {
				warnings.push(`Node "${node.id}" has no path to any output node`);
			}
		}
	}

	// 8. Hard gate ordering warning
	for (const node of dag) {
		if (node.isHardGate) {
			const hasNonGateInputs = node.inputs.some((i) => {
				const inputNode = nodeMap.get(i);
				return inputNode && !inputNode.isHardGate && inputNode.type !== "input";
			});
			if (hasNonGateInputs) {
				warnings.push(
					`Hard gate node "${node.id}" takes inputs from non-gate metric nodes — ensure gate runs before dependent metrics`,
				);
			}
		}
	}

	const valid = errors.length === 0;

	return {
		valid,
		errors,
		warnings,
		...(valid ? { topologicalOrder: order, maxDepth: depth } : {}),
	};
}

/**
 * Format validation errors as a CLI lint report.
 */
export function formatDAGLintReport(result: DAGValidationResult): string {
	const lines: string[] = ["=== DAG Lint ===", ""];

	if (result.valid) {
		lines.push(
			`✓ DAG is valid (depth: ${result.maxDepth}, nodes: ${result.topologicalOrder?.length ?? 0})`,
		);
	} else {
		lines.push(`✗ DAG is INVALID — ${result.errors.length} error(s)`);
	}

	if (result.errors.length > 0) {
		lines.push("", "Errors:");
		for (const err of result.errors) {
			lines.push(`  ✗ [${err.code}] ${err.message}`);
		}
	}

	if (result.warnings.length > 0) {
		lines.push("", "Warnings:");
		for (const w of result.warnings) {
			lines.push(`  ⚠ ${w}`);
		}
	}

	return lines.join("\n");
}
