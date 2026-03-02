import { describe, expect, it } from "vitest";
import { createEvalCase } from "@/lib/testcases/spec";
import {
	clusterBySimilarity,
	computePairwiseSimilarity,
	jaccardSimilarity,
	MAX_PAIRWISE_N,
	tokenize,
} from "@/lib/testgen/deduplicator";

function makeCase(title: string, tags: string[] = []) {
	return createEvalCase({ title, tags });
}

describe("tokenize", () => {
	it("splits into lowercase tokens", () => {
		const tokens = tokenize("Hello World Test");
		expect(tokens.has("hello")).toBe(true);
		expect(tokens.has("world")).toBe(true);
	});

	it("filters short tokens (<=2 chars)", () => {
		const tokens = tokenize("is it a test");
		expect(tokens.has("is")).toBe(false);
		expect(tokens.has("test")).toBe(true);
	});

	it("handles empty string", () => {
		expect(tokenize("").size).toBe(0);
	});
});

describe("jaccardSimilarity", () => {
	it("returns 1.0 for identical sets", () => {
		const a = new Set(["foo", "bar"]);
		const b = new Set(["foo", "bar"]);
		expect(jaccardSimilarity(a, b)).toBe(1.0);
	});

	it("returns 0.0 for disjoint sets", () => {
		const a = new Set(["foo", "bar"]);
		const b = new Set(["baz", "qux"]);
		expect(jaccardSimilarity(a, b)).toBe(0.0);
	});

	it("returns 0.0 for empty sets with one non-empty", () => {
		expect(jaccardSimilarity(new Set(), new Set(["foo"]))).toBe(0.0);
	});

	it("returns 1.0 for two empty sets", () => {
		expect(jaccardSimilarity(new Set(), new Set())).toBe(1.0);
	});

	it("computes correct partial overlap", () => {
		const a = new Set(["foo", "bar", "baz"]);
		const b = new Set(["foo", "bar", "qux"]);
		// intersection: {foo, bar} = 2, union: {foo, bar, baz, qux} = 4
		expect(jaccardSimilarity(a, b)).toBeCloseTo(0.5);
	});
});

describe("computePairwiseSimilarity", () => {
	it("returns n*(n-1)/2 pairs for n cases", () => {
		const cases = [
			makeCase("test one"),
			makeCase("test two"),
			makeCase("test three"),
		];
		const scores = computePairwiseSimilarity(cases);
		expect(scores).toHaveLength(3); // 3*(3-1)/2 = 3
	});

	it("returns empty for single case", () => {
		expect(computePairwiseSimilarity([makeCase("solo")])).toHaveLength(0);
	});

	it("all scores are between 0 and 1", () => {
		const cases = [
			makeCase("refund policy"),
			makeCase("refund request"),
			makeCase("billing issue"),
		];
		const scores = computePairwiseSimilarity(cases);
		for (const s of scores) {
			expect(s.score).toBeGreaterThanOrEqual(0);
			expect(s.score).toBeLessThanOrEqual(1);
		}
	});

	it("similar titles produce higher similarity than dissimilar", () => {
		const c1 = makeCase("refund policy user request");
		const c2 = makeCase("refund policy user cancellation");
		const c3 = makeCase("billing invoice payment");
		const scores = computePairwiseSimilarity([c1, c2, c3]);

		const simPair = scores.find(
			(s) => s.caseIdA === c1.id && s.caseIdB === c2.id,
		)!;
		const diffPair1 = scores.find(
			(s) => s.caseIdA === c1.id && s.caseIdB === c3.id,
		)!;
		const diffPair2 = scores.find(
			(s) => s.caseIdA === c2.id && s.caseIdB === c3.id,
		)!;

		expect(simPair.score).toBeGreaterThan(diffPair1.score);
		expect(simPair.score).toBeGreaterThan(diffPair2.score);
	});
});

describe("MAX_PAIRWISE_N guard", () => {
	it("MAX_PAIRWISE_N constant is exported and equals 500", () => {
		expect(MAX_PAIRWISE_N).toBe(500);
	});

	it("computePairwiseSimilarity throws RangeError when input exceeds explicit maxN", () => {
		const cases = Array.from({ length: 6 }, (_, i) => makeCase(`case ${i}`));
		expect(() => computePairwiseSimilarity(cases, 5)).toThrowError(RangeError);
	});

	it("clusterBySimilarity throws RangeError when input exceeds maxPairwiseN", () => {
		const cases = Array.from({ length: 10 }, (_, i) => makeCase(`case ${i}`));
		expect(() => clusterBySimilarity(cases, 0.5, 5)).toThrowError(RangeError);
	});

	it("passing Infinity disables the guard", () => {
		const cases = Array.from({ length: 10 }, (_, i) =>
			makeCase(`unique case ${i} abcdef`),
		);
		expect(() => clusterBySimilarity(cases, 0.5, Infinity)).not.toThrow();
	});
});

describe("clusterBySimilarity", () => {
	it("returns empty result for empty input", () => {
		const result = clusterBySimilarity([]);
		expect(result.unique).toHaveLength(0);
		expect(result.clusters).toHaveLength(0);
		expect(result.deduplicationRatio).toBe(0);
	});

	it("single case is always unique", () => {
		const result = clusterBySimilarity([makeCase("solo test case")]);
		expect(result.unique).toHaveLength(1);
		expect(result.clusters).toHaveLength(0);
	});

	it("dissimilar cases are all unique", () => {
		const cases = [
			makeCase("refund policy"),
			makeCase("billing invoice payment"),
			makeCase("login authentication security"),
		];
		const result = clusterBySimilarity(cases, 0.5);
		expect(result.unique).toHaveLength(3);
		expect(result.clusters).toHaveLength(0);
	});

	it("very similar cases form a cluster", () => {
		const cases = [
			makeCase("refund policy user request help"),
			makeCase("refund policy user request support"),
			makeCase("billing invoice unrelated"),
		];
		const result = clusterBySimilarity(cases, 0.3);
		const totalAssigned =
			result.unique.length +
			result.clusters.reduce(
				(sum: number, c: { memberIds: string[] }) => sum + c.memberIds.length,
				0,
			);
		expect(totalAssigned).toBe(cases.length);
	});

	it("deduplicationRatio is 0 when all unique", () => {
		const cases = [
			makeCase("alpha test"),
			makeCase("beta exam"),
			makeCase("gamma quiz"),
		];
		const result = clusterBySimilarity(cases, 0.99);
		expect(result.deduplicationRatio).toBe(0);
	});

	it("clusters have valid canonicalId", () => {
		const cases = [
			makeCase("refund policy user request help refund"),
			makeCase("refund policy user request help support"),
		];
		const result = clusterBySimilarity(cases, 0.3);
		for (const cluster of result.clusters) {
			expect(cluster.memberIds).toContain(cluster.canonicalId);
		}
	});

	it("total cases accounted for (unique + cluster members = input count)", () => {
		const cases = [
			makeCase("refund help request"),
			makeCase("refund help support"),
			makeCase("billing payment invoice"),
		];
		const result = clusterBySimilarity(cases, 0.3);
		const total =
			result.unique.length +
			result.clusters.reduce((sum, c) => sum + c.memberIds.length, 0);
		expect(total).toBe(cases.length);
	});
});
