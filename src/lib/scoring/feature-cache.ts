/**
 * Feature Cache — Caching contract for trace feature extraction.
 *
 * Guarantees that feature extraction runs at most once per (traceId, featureVersion)
 * pair. UI and report paths call extractOrGetCached() — they never recompute
 * features for a trace+version they've already seen.
 *
 * The cache store is injected by callers (in-memory for tests, DB-backed in prod).
 * This module contains ZERO database imports.
 */

import {
	extractTraceFeatures,
	FEATURE_VERSION,
	type TraceFeatures,
	type TraceSpanForExtraction,
} from "./trace-feature-extractor";

export { FEATURE_VERSION };

// ── Cache key ─────────────────────────────────────────────────────────────────

/**
 * Compute a deterministic cache key for a (traceId, featureVersion) pair.
 * Format: `feat:<featureVersion>:<traceId>`
 */
export function featureCacheKey(
	traceId: string,
	featureVersion = FEATURE_VERSION,
): string {
	return `feat:${featureVersion}:${traceId}`;
}

// ── Cache store interface ─────────────────────────────────────────────────────

/** Minimal read/write interface the cache store must satisfy. */
export interface FeatureCacheStore {
	get(key: string): TraceFeatures | undefined;
	set(key: string, features: TraceFeatures): void;
	has(key: string): boolean;
}

// ── In-memory implementation (for tests + local dev) ─────────────────────────

/**
 * Simple in-memory cache store. Not shared across processes.
 * Use for tests and local development.
 */
export class InMemoryFeatureCache implements FeatureCacheStore {
	private readonly store = new Map<string, TraceFeatures>();

	get(key: string): TraceFeatures | undefined {
		return this.store.get(key);
	}

	set(key: string, features: TraceFeatures): void {
		this.store.set(key, features);
	}

	has(key: string): boolean {
		return this.store.has(key);
	}

	/** Number of cached entries (for testing / diagnostics). */
	get size(): number {
		return this.store.size;
	}

	/** Evict a specific key (for testing). */
	delete(key: string): boolean {
		return this.store.delete(key);
	}

	/** Clear all cached entries (for testing). */
	clear(): void {
		this.store.clear();
	}
}

// ── Core: extract or serve from cache ────────────────────────────────────────

export interface ExtractionResult {
	features: TraceFeatures;
	/** true = served from cache; false = freshly computed and stored */
	cacheHit: boolean;
	/** The cache key that was used */
	cacheKey: string;
}

/**
 * Return cached features if available, otherwise extract and store.
 *
 * Acceptance contract:
 *   - For the same (traceId, featureVersion), the store is written to exactly once.
 *   - Subsequent calls return cacheHit=true without calling extractTraceFeatures.
 *   - Callers (UI, report paths) MUST use this function, not extractTraceFeatures directly.
 */
export function extractOrGetCached(
	traceId: string,
	spans: TraceSpanForExtraction[],
	store: FeatureCacheStore,
	featureVersion = FEATURE_VERSION,
): ExtractionResult {
	const key = featureCacheKey(traceId, featureVersion);

	const cached = store.get(key);
	if (cached !== undefined) {
		return { features: cached, cacheHit: true, cacheKey: key };
	}

	const features = extractTraceFeatures(spans);
	store.set(key, features);
	return { features, cacheHit: false, cacheKey: key };
}

// ── Batch extraction ──────────────────────────────────────────────────────────

export interface BatchExtractionInput {
	traceId: string;
	spans: TraceSpanForExtraction[];
}

export interface BatchExtractionResult {
	results: Array<ExtractionResult & { traceId: string }>;
	cacheHits: number;
	cacheMisses: number;
}

/**
 * Extract features for multiple traces, serving from cache where possible.
 */
export function extractBatch(
	inputs: BatchExtractionInput[],
	store: FeatureCacheStore,
	featureVersion = FEATURE_VERSION,
): BatchExtractionResult {
	const results: Array<ExtractionResult & { traceId: string }> = [];
	let cacheHits = 0;
	let cacheMisses = 0;

	for (const { traceId, spans } of inputs) {
		const result = extractOrGetCached(traceId, spans, store, featureVersion);
		results.push({ ...result, traceId });
		if (result.cacheHit) cacheHits++;
		else cacheMisses++;
	}

	return { results, cacheHits, cacheMisses };
}

// ── Cache stats ───────────────────────────────────────────────────────────────

export interface CacheStats {
	featureVersion: string;
	totalKeys: number;
	hitRate: number | null;
}

/**
 * Compute hit-rate stats from a completed batch result.
 */
export function computeCacheStats(
	batch: BatchExtractionResult,
	featureVersion = FEATURE_VERSION,
): CacheStats {
	const total = batch.cacheHits + batch.cacheMisses;
	return {
		featureVersion,
		totalKeys: total,
		hitRate: total > 0 ? batch.cacheHits / total : null,
	};
}
