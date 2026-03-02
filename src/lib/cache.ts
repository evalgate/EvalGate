/**
 * Unified Caching Layer
 *
 * Combines Next.js `unstable_cache` for request-level/ISR DB query caching
 * with the existing Redis layer for hot-path distributed caching.
 *
 * ┌──────────────┐       ┌────────────────┐       ┌─────────┐
 * │ unstable_cache│ ───▶  │ Redis (optional)│ ───▶  │  DB     │
 * │ (Next data    │       │ (hot paths)     │       │         │
 * │  cache / ISR) │       └────────────────┘       └─────────┘
 * └──────────────┘
 *
 * Usage:
 *   import { cachedDbQuery, cachedHotPath, invalidateTag } from "@/lib/cache";
 */

import { unstable_cache } from "next/cache";
import { cache as reactCache } from "react";
import { logger } from "@/lib/logger";
import { CacheTTL, cache as redisCache } from "@/lib/redis-cache";

// ── Next.js Data Cache (unstable_cache) ────────────────────

export interface DbCacheOptions {
	tags?: string[];
	revalidateSeconds?: number;
}

/**
 * Wrap a DB query with Next.js `unstable_cache` for automatic
 * deduplication and ISR-style time-based revalidation.
 *
 * Results are stored in the Next.js Data Cache and shared across
 * requests within the same deployment.
 *
 * @param keyParts Unique cache key segments (e.g. ["evaluations", "org", orgId])
 * @param fn       Async function that returns the data
 * @param opts     Optional tags (for `revalidateTag`) and TTL
 */
export function cachedDbQuery<T>(
	keyParts: string[],
	fn: () => Promise<T>,
	opts: DbCacheOptions = {},
): Promise<T> {
	const { tags = [], revalidateSeconds = 60 } = opts;

	const cachedFn = unstable_cache(fn, keyParts, {
		tags: [...tags, "db"],
		revalidate: revalidateSeconds,
	});

	return cachedFn();
}

// ── React.cache() for per-request deduplication ────────────

/**
 * Deduplicate an async call within a single React Server Component
 * render tree. Unlike `unstable_cache`, this does NOT persist across
 * requests — it only prevents duplicate calls within one render.
 */
export function deduplicatedQuery<T>(fn: () => Promise<T>): () => Promise<T> {
	return reactCache(fn);
}

// ── Redis Hot-Path Cache ───────────────────────────────────

export interface HotPathOptions {
	ttlSeconds?: number;
	organizationId?: number;
	resource?: string;
}

/**
 * Cache a computation in Redis for cross-instance, cross-request
 * sharing. Best for data that is expensive to compute and read
 * frequently (leaderboards, aggregations, config lookups).
 *
 * Falls back gracefully to executing `fn` when Redis is unavailable.
 */
export async function cachedHotPath<T>(
	key: string,
	fn: () => Promise<T>,
	opts: HotPathOptions = {},
): Promise<T> {
	const { ttlSeconds = CacheTTL.MEDIUM, organizationId, resource } = opts;

	const fullKey = organizationId
		? `${resource || "hot"}:org:${organizationId}:${key}`
		: `${resource || "hot"}:${key}`;

	return redisCache.wrap<T>(fullKey, fn, { ttl: ttlSeconds });
}

// ── Tag-Based Invalidation ─────────────────────────────────

/**
 * Invalidate Next.js Data Cache entries by tag.
 * Also clears the corresponding Redis keys for the resource.
 *
 * Call this after mutations (create/update/delete).
 */
export async function invalidateTag(
	tag: string,
	organizationId?: number,
): Promise<void> {
	try {
		const { revalidateTag } = await import("next/cache");
		(revalidateTag as (tag: string) => void)(tag);
	} catch {
		logger.debug("revalidateTag unavailable (non-Next.js context)", { tag });
	}

	if (organizationId) {
		await redisCache.invalidateResource(tag, organizationId);
	}
}

/**
 * Convenience: invalidate all caches for an organization after a
 * broad mutation (e.g. org settings change, bulk import).
 */
export async function invalidateOrganization(
	organizationId: number,
): Promise<void> {
	try {
		const { revalidateTag } = await import("next/cache");
		(revalidateTag as (tag: string) => void)(`org:${organizationId}`);
	} catch {
		logger.debug("revalidateTag unavailable", { organizationId });
	}

	await redisCache.invalidateOrganization(organizationId);
}

// Re-export TTL constants for convenience
export { CacheTTL } from "@/lib/redis-cache";
