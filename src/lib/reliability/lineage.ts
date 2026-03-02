/**
 * Lineage — graph traversal over ReliabilityObject version chains.
 *
 * Lineage answers questions like:
 *   "What is the full ancestry of this failure?"
 *   "Which baselines descended from this trace?"
 *   "Which version of this metric was active when this regression was detected?"
 */

import type { ReliabilityObject } from "./reliability-object";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LineageNode {
	id: string;
	version: number;
	parentVersion: number | null;
	createdFrom: string | null;
	type: string;
	createdAt: string;
	reason?: string;
}

export interface LineageChain {
	/** The entity id this chain belongs to */
	entityId: string;
	/** Ordered ancestor → descendant (index 0 = oldest) */
	chain: LineageNode[];
	/** Total depth of the chain */
	depth: number;
}

export interface LineageGraph {
	/** All nodes keyed by `${entityId}@v${version}` */
	nodes: Map<string, LineageNode>;
	/** Edges: parent key → child keys */
	edges: Map<string, string[]>;
}

// ── Node conversion ──────────────────────────────────────────────────────────

export function toLineageNode(obj: ReliabilityObject): LineageNode {
	return {
		id: obj.id,
		version: obj.version,
		parentVersion: obj.parentVersion,
		createdFrom: obj.createdFrom,
		type: obj.type,
		createdAt: obj.provenance.createdAt,
		reason: obj.provenance.reason,
	};
}

// ── Key helpers ──────────────────────────────────────────────────────────────

function nodeKey(id: string, version: number): string {
	return `${id}@v${version}`;
}

// ── Graph builder ────────────────────────────────────────────────────────────

/**
 * Build a lineage graph from a set of ReliabilityObjects for the same entity.
 * Objects do not need to be sorted.
 */
export function buildLineageGraph(objects: ReliabilityObject[]): LineageGraph {
	const nodes = new Map<string, LineageNode>();
	const edges = new Map<string, string[]>();

	for (const obj of objects) {
		const key = nodeKey(obj.id, obj.version);
		nodes.set(key, toLineageNode(obj));

		if (obj.parentVersion !== null) {
			const parentKey = nodeKey(obj.id, obj.parentVersion);
			const children = edges.get(parentKey) ?? [];
			children.push(key);
			edges.set(parentKey, children);
		}
	}

	return { nodes, edges };
}

// ── Ancestry traversal ───────────────────────────────────────────────────────

/**
 * Reconstruct the full ancestor chain for a specific version.
 * Returns nodes ordered oldest → newest.
 */
export function getAncestorChain(
	graph: LineageGraph,
	entityId: string,
	targetVersion: number,
): LineageChain {
	const chain: LineageNode[] = [];
	let currentVersion: number | null = targetVersion;

	while (currentVersion !== null) {
		const key = nodeKey(entityId, currentVersion);
		const node = graph.nodes.get(key);
		if (!node) break;

		chain.unshift(node);
		currentVersion = node.parentVersion;
	}

	return {
		entityId,
		chain,
		depth: chain.length,
	};
}

/**
 * Get all descendants of a given version (breadth-first).
 */
export function getDescendants(
	graph: LineageGraph,
	entityId: string,
	fromVersion: number,
): LineageNode[] {
	const result: LineageNode[] = [];
	const queue: string[] = [nodeKey(entityId, fromVersion)];

	while (queue.length > 0) {
		const current = queue.shift()!;
		const children = graph.edges.get(current) ?? [];
		for (const childKey of children) {
			const node = graph.nodes.get(childKey);
			if (node) {
				result.push(node);
				queue.push(childKey);
			}
		}
	}

	return result;
}

/**
 * Find the common ancestor version of two objects with the same entityId.
 * Returns null if no common ancestor exists.
 */
export function findCommonAncestor(
	graph: LineageGraph,
	entityId: string,
	versionA: number,
	versionB: number,
): LineageNode | null {
	const ancestorsA = new Set<number>();
	let cur: number | null = versionA;

	while (cur !== null) {
		ancestorsA.add(cur);
		const key = nodeKey(entityId, cur);
		const node = graph.nodes.get(key);
		cur = node?.parentVersion ?? null;
	}

	let curB: number | null = versionB;
	while (curB !== null) {
		if (ancestorsA.has(curB)) {
			const key = nodeKey(entityId, curB);
			return graph.nodes.get(key) ?? null;
		}
		const key = nodeKey(entityId, curB);
		const node = graph.nodes.get(key);
		curB = node?.parentVersion ?? null;
	}

	return null;
}

/**
 * Get the root (v1) node for an entity from the graph.
 */
export function getRootNode(
	graph: LineageGraph,
	entityId: string,
): LineageNode | null {
	return graph.nodes.get(nodeKey(entityId, 1)) ?? null;
}
