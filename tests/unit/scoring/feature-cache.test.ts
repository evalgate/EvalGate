import { describe, expect, it } from "vitest";
import {
	computeCacheStats,
	extractBatch,
	extractOrGetCached,
	FEATURE_VERSION,
	featureCacheKey,
	InMemoryFeatureCache,
} from "@/lib/scoring/feature-cache";
import type { TraceSpanForExtraction } from "@/lib/scoring/trace-feature-extractor";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FEATURE_VERSION_IMPORT = FEATURE_VERSION;

function span(id = "s1"): TraceSpanForExtraction {
	return {
		spanId: id,
		name: "llm-call",
		type: "llm",
		behavioral: {
			messages: [{ role: "user", content: "hello" }],
			toolCalls: [{ name: "search", arguments: { q: "test" }, success: true }],
		},
	};
}

// ── featureCacheKey ───────────────────────────────────────────────────────────

describe("featureCacheKey", () => {
	it("produces expected format", () => {
		expect(featureCacheKey("trace-abc")).toBe(
			`feat:${FEATURE_VERSION_IMPORT}:trace-abc`,
		);
	});

	it("accepts custom featureVersion", () => {
		expect(featureCacheKey("trace-abc", "v2")).toBe("feat:v2:trace-abc");
	});

	it("produces distinct keys for different trace IDs", () => {
		expect(featureCacheKey("t1")).not.toBe(featureCacheKey("t2"));
	});

	it("produces distinct keys for different feature versions", () => {
		expect(featureCacheKey("t1", "v1")).not.toBe(featureCacheKey("t1", "v2"));
	});
});

// ── InMemoryFeatureCache ──────────────────────────────────────────────────────

describe("InMemoryFeatureCache", () => {
	it("starts empty", () => {
		const cache = new InMemoryFeatureCache();
		expect(cache.size).toBe(0);
	});

	it("stores and retrieves entries", () => {
		const cache = new InMemoryFeatureCache();
		const features = extractOrGetCached("t1", [span()], cache);
		expect(cache.size).toBe(1);
		expect(cache.get(features.cacheKey)).toBeDefined();
	});

	it("has() returns true after set", () => {
		const cache = new InMemoryFeatureCache();
		extractOrGetCached("t1", [span()], cache);
		expect(cache.has(featureCacheKey("t1"))).toBe(true);
	});

	it("has() returns false for missing key", () => {
		const cache = new InMemoryFeatureCache();
		expect(cache.has("feat:v1:missing")).toBe(false);
	});

	it("delete() removes a specific key", () => {
		const cache = new InMemoryFeatureCache();
		extractOrGetCached("t1", [span()], cache);
		cache.delete(featureCacheKey("t1"));
		expect(cache.size).toBe(0);
	});

	it("clear() empties the cache", () => {
		const cache = new InMemoryFeatureCache();
		extractOrGetCached("t1", [span()], cache);
		extractOrGetCached("t2", [span()], cache);
		cache.clear();
		expect(cache.size).toBe(0);
	});
});

// ── extractOrGetCached ────────────────────────────────────────────────────────

describe("extractOrGetCached", () => {
	it("returns cacheHit=false on first call and stores result", () => {
		const cache = new InMemoryFeatureCache();
		const result = extractOrGetCached("trace-1", [span()], cache);
		expect(result.cacheHit).toBe(false);
		expect(result.features).toBeDefined();
		expect(result.features.featureVersion).toBe(FEATURE_VERSION_IMPORT);
	});

	it("returns cacheHit=true on second call with same traceId", () => {
		const cache = new InMemoryFeatureCache();
		extractOrGetCached("trace-1", [span()], cache);
		const second = extractOrGetCached("trace-1", [span()], cache);
		expect(second.cacheHit).toBe(true);
	});

	it("returns identical features on cache hit", () => {
		const cache = new InMemoryFeatureCache();
		const first = extractOrGetCached("trace-1", [span()], cache);
		const second = extractOrGetCached("trace-1", [span()], cache);
		expect(second.features).toBe(first.features); // same object reference
	});

	it("uses different cache keys for different traceIds", () => {
		const cache = new InMemoryFeatureCache();
		extractOrGetCached("t1", [span()], cache);
		extractOrGetCached("t2", [span()], cache);
		expect(cache.size).toBe(2);
	});

	it("treats different featureVersions as cache misses", () => {
		const cache = new InMemoryFeatureCache();
		const r1 = extractOrGetCached("t1", [span()], cache, "v1");
		const r2 = extractOrGetCached("t1", [span()], cache, "v2");
		expect(r1.cacheHit).toBe(false);
		expect(r2.cacheHit).toBe(false);
		expect(cache.size).toBe(2);
	});

	it("cache key matches featureCacheKey output", () => {
		const cache = new InMemoryFeatureCache();
		const result = extractOrGetCached("t1", [span()], cache);
		expect(result.cacheKey).toBe(featureCacheKey("t1"));
	});
});

// ── extractBatch ──────────────────────────────────────────────────────────────

describe("extractBatch", () => {
	it("processes all inputs and returns results", () => {
		const cache = new InMemoryFeatureCache();
		const batch = extractBatch(
			[
				{ traceId: "t1", spans: [span()] },
				{ traceId: "t2", spans: [span()] },
			],
			cache,
		);
		expect(batch.results).toHaveLength(2);
		expect(batch.cacheMisses).toBe(2);
		expect(batch.cacheHits).toBe(0);
	});

	it("counts cache hits correctly on second batch", () => {
		const cache = new InMemoryFeatureCache();
		extractBatch([{ traceId: "t1", spans: [span()] }], cache);
		const second = extractBatch(
			[
				{ traceId: "t1", spans: [span()] }, // hit
				{ traceId: "t2", spans: [span()] }, // miss
			],
			cache,
		);
		expect(second.cacheHits).toBe(1);
		expect(second.cacheMisses).toBe(1);
	});

	it("attaches traceId to each result", () => {
		const cache = new InMemoryFeatureCache();
		const batch = extractBatch(
			[{ traceId: "my-trace", spans: [span()] }],
			cache,
		);
		expect(batch.results[0]!.traceId).toBe("my-trace");
	});

	it("handles empty input", () => {
		const cache = new InMemoryFeatureCache();
		const batch = extractBatch([], cache);
		expect(batch.results).toHaveLength(0);
		expect(batch.cacheHits).toBe(0);
		expect(batch.cacheMisses).toBe(0);
	});
});

// ── computeCacheStats ─────────────────────────────────────────────────────────

describe("computeCacheStats", () => {
	it("computes 100% hit rate", () => {
		const stats = computeCacheStats({
			results: [],
			cacheHits: 5,
			cacheMisses: 0,
		});
		expect(stats.hitRate).toBe(1);
	});

	it("computes 0% hit rate", () => {
		const stats = computeCacheStats({
			results: [],
			cacheHits: 0,
			cacheMisses: 4,
		});
		expect(stats.hitRate).toBe(0);
	});

	it("computes 50% hit rate", () => {
		const stats = computeCacheStats({
			results: [],
			cacheHits: 2,
			cacheMisses: 2,
		});
		expect(stats.hitRate).toBe(0.5);
	});

	it("returns null hit rate for empty batch", () => {
		const stats = computeCacheStats({
			results: [],
			cacheHits: 0,
			cacheMisses: 0,
		});
		expect(stats.hitRate).toBeNull();
	});

	it("includes featureVersion in stats", () => {
		const stats = computeCacheStats({
			results: [],
			cacheHits: 1,
			cacheMisses: 0,
		});
		expect(stats.featureVersion).toBe(FEATURE_VERSION_IMPORT);
	});
});
