import { describe, expect, it, vi } from "vitest";
import {
	type BehaviorPoint,
	buildCoverageModel,
	computeEmbeddingVersionHash,
} from "@/lib/dataset/coverage-model";

// ── Helpers ───────────────────────────────────────────────────────────────────

function point(id: string, text: string): BehaviorPoint {
	return { id, text };
}

/**
 * Deterministic mock embedding: returns a 3-dim vector based on
 * which category keywords appear, producing reliably separated clusters.
 */
function mockEmbeddingFn(text: string): number[] {
	const lower = text.toLowerCase();
	const mathScore = lower.includes("math") || lower.includes("calcul") ? 1 : 0;
	const refundScore =
		lower.includes("refund") || lower.includes("return") ? 1 : 0;
	const authScore = lower.includes("login") || lower.includes("auth") ? 1 : 0;
	return [mathScore, refundScore, authScore];
}

const mathPoints: BehaviorPoint[] = [
	point("m1", "calculate the sum of two numbers"),
	point("m2", "math problem: multiply integers"),
	point("m3", "solve this math equation"),
];

const refundPoints: BehaviorPoint[] = [
	point("r1", "process a refund for a cancelled order"),
	point("r2", "return policy for partial refund"),
	point("r3", "refund request handling"),
];

const authPoints: BehaviorPoint[] = [
	point("a1", "user login with incorrect password"),
	point("a2", "auth token expiry handling"),
	point("a3", "login attempts and lockout"),
];

const allPoints = [...mathPoints, ...refundPoints, ...authPoints];

// ── computeEmbeddingVersionHash ───────────────────────────────────────────────

describe("computeEmbeddingVersionHash", () => {
	it("returns a non-empty hex string", () => {
		const h = computeEmbeddingVersionHash("text-embedding-3-small", 1536);
		expect(h).toMatch(/^[0-9a-f]{8}$/);
	});

	it("is deterministic", () => {
		const h1 = computeEmbeddingVersionHash("model-a", 512);
		const h2 = computeEmbeddingVersionHash("model-a", 512);
		expect(h1).toBe(h2);
	});

	it("differs for different models", () => {
		const h1 = computeEmbeddingVersionHash("model-a", 512);
		const h2 = computeEmbeddingVersionHash("model-b", 512);
		expect(h1).not.toBe(h2);
	});

	it("differs for different dimensions", () => {
		const h1 = computeEmbeddingVersionHash("model-a", 512);
		const h2 = computeEmbeddingVersionHash("model-a", 1536);
		expect(h1).not.toBe(h2);
	});
});

// ── buildCoverageModel with embeddings ────────────────────────────────────────

describe("buildCoverageModel — embedding mode (useEmbeddings=true)", () => {
	it("accepts embeddingFn and produces clusters", () => {
		const model = buildCoverageModel(allPoints, 3, {
			embeddingFn: mockEmbeddingFn,
			useEmbeddings: true,
			seedPhrases: [],
		});
		expect(model.clusters.length).toBeGreaterThan(0);
		expect(model.totalTestCases).toBe(9);
	});

	it("calls embeddingFn once per point", () => {
		const embeddingFn = vi.fn(mockEmbeddingFn);
		buildCoverageModel(allPoints, 3, {
			embeddingFn,
			useEmbeddings: true,
			seedPhrases: [],
		});
		expect(embeddingFn).toHaveBeenCalledTimes(allPoints.length);
	});

	it("groups semantically similar points into same cluster", () => {
		const model = buildCoverageModel(allPoints, 3, {
			embeddingFn: mockEmbeddingFn,
			useEmbeddings: true,
			seedPhrases: [],
		});
		// Each math point should be in the same cluster
		const mathIds = new Set(mathPoints.map((p) => p.id));
		const clusterWithMath = model.clusters.find((c) =>
			c.memberIds.some((id) => mathIds.has(id)),
		);
		expect(clusterWithMath).toBeDefined();
		// All math IDs should be in that cluster
		const mathInCluster = clusterWithMath!.memberIds.filter((id) =>
			mathIds.has(id),
		);
		expect(mathInCluster.length).toBe(mathPoints.length);
	});

	it("produces a valid coverageRatio between 0 and 1", () => {
		const model = buildCoverageModel(allPoints, 3, {
			embeddingFn: mockEmbeddingFn,
			useEmbeddings: true,
		});
		expect(model.coverageRatio).toBeGreaterThanOrEqual(0);
		expect(model.coverageRatio).toBeLessThanOrEqual(1);
	});

	it("all points are assigned to exactly one cluster", () => {
		const model = buildCoverageModel(allPoints, 3, {
			embeddingFn: mockEmbeddingFn,
			useEmbeddings: true,
			seedPhrases: [],
		});
		const allAssigned = model.clusters.flatMap((c) => c.memberIds);
		expect(allAssigned.sort()).toEqual(allPoints.map((p) => p.id).sort());
	});
});

// ── Feature flag: useEmbeddings=false falls back to BoW ──────────────────────

describe("buildCoverageModel — feature flag: useEmbeddings=false", () => {
	it("does NOT call embeddingFn when useEmbeddings=false", () => {
		const embeddingFn = vi.fn(mockEmbeddingFn);
		buildCoverageModel(allPoints, 3, {
			embeddingFn,
			useEmbeddings: false,
			seedPhrases: [],
		});
		expect(embeddingFn).not.toHaveBeenCalled();
	});

	it("falls back to BoW and still produces clusters", () => {
		const model = buildCoverageModel(allPoints, 3, {
			embeddingFn: mockEmbeddingFn,
			useEmbeddings: false,
			seedPhrases: [],
		});
		expect(model.clusters.length).toBeGreaterThan(0);
	});

	it("does NOT call embeddingFn when embeddingFn is omitted", () => {
		const embeddingFn = vi.fn(mockEmbeddingFn);
		// No embeddingFn in options — BoW path
		buildCoverageModel(allPoints, 3, { seedPhrases: [] });
		expect(embeddingFn).not.toHaveBeenCalled();
	});
});

// ── EmbeddingVersionInfo ──────────────────────────────────────────────────────

describe("embeddingVersion option", () => {
	it("model builds successfully when embeddingVersion is supplied", () => {
		const versionHash = computeEmbeddingVersionHash("test-model", 3);
		const model = buildCoverageModel(allPoints, 3, {
			embeddingFn: mockEmbeddingFn,
			useEmbeddings: true,
			embeddingVersion: {
				model: "test-model",
				dimensions: 3,
				versionHash,
			},
			seedPhrases: [],
		});
		expect(model.totalTestCases).toBe(9);
	});
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("buildCoverageModel with embeddings — edge cases", () => {
	it("returns empty model for zero points", () => {
		const embeddingFn = vi.fn(mockEmbeddingFn);
		const model = buildCoverageModel([], 3, {
			embeddingFn,
			useEmbeddings: true,
			seedPhrases: [],
		});
		expect(model.totalTestCases).toBe(0);
		expect(embeddingFn).not.toHaveBeenCalled();
	});

	it("handles single point with embeddings", () => {
		const model = buildCoverageModel([point("x", "single math test")], 3, {
			embeddingFn: mockEmbeddingFn,
			useEmbeddings: true,
			seedPhrases: [],
		});
		expect(model.clusters).toHaveLength(1);
		expect(model.clusters[0]!.memberIds).toContain("x");
	});

	it("k larger than points clamps correctly", () => {
		const twoPoints = [point("a", "refund request"), point("b", "login auth")];
		const model = buildCoverageModel(twoPoints, 10, {
			embeddingFn: mockEmbeddingFn,
			useEmbeddings: true,
			seedPhrases: [],
		});
		expect(model.clusters.length).toBeLessThanOrEqual(2);
	});
});
