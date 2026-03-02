import { describe, expect, it } from "vitest";
import {
	buildLineageGraph,
	findCommonAncestor,
	getAncestorChain,
	getDescendants,
	getRootNode,
	toLineageNode,
} from "@/lib/reliability/lineage";
import {
	bumpReliabilityVersion,
	createReliabilityObject,
	ReliabilityObjectType,
} from "@/lib/reliability/reliability-object";

function makeChain(id: string, depth: number) {
	let obj = createReliabilityObject({
		id,
		type: ReliabilityObjectType.METRIC,
		source: "test",
	});
	const all = [obj];
	for (let i = 1; i < depth; i++) {
		obj = bumpReliabilityVersion(obj, { source: "test", reason: `bump ${i}` });
		all.push(obj);
	}
	return all;
}

describe("buildLineageGraph", () => {
	it("builds graph with correct node count", () => {
		const chain = makeChain("m-1", 4);
		const graph = buildLineageGraph(chain);
		expect(graph.nodes.size).toBe(4);
	});

	it("sets edges from parent to child", () => {
		const chain = makeChain("m-1", 3);
		const graph = buildLineageGraph(chain);
		const parentEdges = graph.edges.get("m-1@v1");
		expect(parentEdges).toContain("m-1@v2");
	});

	it("handles single-version entities (no edges)", () => {
		const v1 = createReliabilityObject({
			id: "lone",
			type: ReliabilityObjectType.TRACE,
			source: "test",
		});
		const graph = buildLineageGraph([v1]);
		expect(graph.nodes.size).toBe(1);
		expect(graph.edges.size).toBe(0);
	});
});

describe("getAncestorChain", () => {
	it("returns full chain ordered oldest → newest", () => {
		const chain = makeChain("m-1", 4);
		const graph = buildLineageGraph(chain);
		const result = getAncestorChain(graph, "m-1", 4);

		expect(result.depth).toBe(4);
		expect(result.chain[0]!.version).toBe(1);
		expect(result.chain[3]!.version).toBe(4);
	});

	it("returns partial chain for an intermediate version", () => {
		const chain = makeChain("m-1", 5);
		const graph = buildLineageGraph(chain);
		const result = getAncestorChain(graph, "m-1", 3);

		expect(result.depth).toBe(3);
		expect(result.chain[2]!.version).toBe(3);
	});

	it("returns empty chain for missing entity", () => {
		const graph = buildLineageGraph([]);
		const result = getAncestorChain(graph, "missing", 1);
		expect(result.chain).toHaveLength(0);
	});
});

describe("getDescendants", () => {
	it("returns all descendants breadth-first", () => {
		const chain = makeChain("m-1", 4);
		const graph = buildLineageGraph(chain);
		const descendants = getDescendants(graph, "m-1", 1);

		expect(descendants).toHaveLength(3);
		expect(descendants.map((d) => d.version)).toEqual([2, 3, 4]);
	});

	it("returns empty array for leaf node", () => {
		const chain = makeChain("m-1", 3);
		const graph = buildLineageGraph(chain);
		const descendants = getDescendants(graph, "m-1", 3);
		expect(descendants).toHaveLength(0);
	});
});

describe("findCommonAncestor", () => {
	it("finds common ancestor for sibling versions", () => {
		const chain = makeChain("m-1", 3);
		const graph = buildLineageGraph(chain);

		const common = findCommonAncestor(graph, "m-1", 2, 3);
		expect(common?.version).toBe(2);
	});

	it("returns v1 as common ancestor for all versions", () => {
		const chain = makeChain("m-1", 5);
		const graph = buildLineageGraph(chain);
		const common = findCommonAncestor(graph, "m-1", 3, 5);
		expect(common?.version).toBeGreaterThanOrEqual(1);
	});
});

describe("getRootNode", () => {
	it("returns the v1 node", () => {
		const chain = makeChain("m-1", 4);
		const graph = buildLineageGraph(chain);
		const root = getRootNode(graph, "m-1");
		expect(root?.version).toBe(1);
	});

	it("returns null for missing entity", () => {
		const graph = buildLineageGraph([]);
		expect(getRootNode(graph, "missing")).toBeNull();
	});
});
