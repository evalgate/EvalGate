import * as Sentry from "@sentry/nextjs";
import { type Duration, Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

type RateLimitTier = "free" | "pro" | "enterprise" | "anonymous" | "mcp";

/** Classifies a route's sensitivity — `"sensitive"` routes are blocked when Redis is unavailable. */
export type RouteRisk = "sensitive" | "read-only";

// Rate limit configurations for different tiers (softer limits for better DX)
const RATE_LIMITS: Record<
	RateLimitTier,
	{ requests: number; window: Duration }
> = {
	anonymous: { requests: 30, window: "1 m" },
	free: { requests: 200, window: "1 m" },
	pro: { requests: 1000, window: "1 m" },
	enterprise: { requests: 10000, window: "1 m" },
	mcp: { requests: 100, window: "1 m" },
};

const WINDOW_MS = 60_000;
const MAX_MEMORY_KEYS = 10_000;

const memoryStore = new Map<string, number[]>();
let warnedOnce = false;

// Check if Redis is configured
const isRedisConfigured = !!(
	process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

// Initialize Redis client only if configured
const redis = isRedisConfigured
	? new Redis({
			url: process.env.UPSTASH_REDIS_REST_URL || "",
			token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
		})
	: null;

// Create rate limiters for each tier (only if Redis is configured)
const rateLimiters: Record<string, Ratelimit> = {};

if (redis) {
	Object.entries(RATE_LIMITS).forEach(([tier, config]) => {
		rateLimiters[tier] = new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(config.requests, config.window),
			analytics: true,
			prefix: `@upstash/ratelimit_${tier}`,
		});
	});
}

function inMemoryFallback(
	identifier: string,
	tier: RateLimitTier,
	routeRisk: RouteRisk,
	metadata?: Record<string, unknown>,
): { success: boolean; headers: Record<string, string> } {
	if (!warnedOnce) {
		warnedOnce = true;
		logger.error(
			"Redis unavailable — rate limiting falling back to in-memory",
			{ tier, routeRisk },
		);
	}

	Sentry.captureEvent({
		message: "Rate-limit Redis unavailable, using fallback",
		level: "warning",
		extra: { tier, routeRisk, ...metadata },
	});

	if (routeRisk === "sensitive") {
		return {
			success: false,
			headers: {
				"X-RateLimit-Limit": "0",
				"X-RateLimit-Remaining": "0",
				"X-RateLimit-Reset": String(Date.now() + WINDOW_MS),
				"Retry-After": String(Math.ceil(WINDOW_MS / 1000)),
			},
		};
	}

	if (memoryStore.size >= MAX_MEMORY_KEYS) {
		memoryStore.clear();
	}

	const now = Date.now();
	const key = `${tier}:${identifier}`;
	const timestamps = (memoryStore.get(key) ?? []).filter(
		(t) => t > now - WINDOW_MS,
	);

	const limit = Math.max(1, Math.floor(RATE_LIMITS[tier].requests / 4));
	const success = timestamps.length < limit;

	if (success) {
		timestamps.push(now);
	}
	memoryStore.set(key, timestamps);

	const remaining = Math.max(0, limit - timestamps.length);
	const reset = now + WINDOW_MS;

	const headers: Record<string, string> = {
		"X-RateLimit-Limit": String(limit),
		"X-RateLimit-Remaining": String(remaining),
		"X-RateLimit-Reset": String(reset),
	};

	if (!success) {
		headers["Retry-After"] = String(Math.ceil(WINDOW_MS / 1000));
	}

	return { success, headers };
}

/** Check whether `identifier` exceeds the rate limit for the given tier, returning success status and standard rate-limit headers. */
export async function checkRateLimit(
	identifier: string,
	tier: RateLimitTier = "anonymous",
	routeRisk: RouteRisk = "read-only",
	metadata?: Record<string, unknown>,
): Promise<{ success: boolean; headers: Record<string, string> }> {
	if (!redis || Object.keys(rateLimiters).length === 0) {
		return inMemoryFallback(identifier, tier, routeRisk, metadata);
	}

	// Get the appropriate rate limiter for the tier
	const rateLimiter = rateLimiters[tier] || rateLimiters.anonymous;

	// Check rate limit
	const result = await rateLimiter.limit(identifier);

	const headers: Record<string, string> = {
		"X-RateLimit-Limit": result.limit.toString(),
		"X-RateLimit-Remaining": result.remaining.toString(),
		"X-RateLimit-Reset": result.reset.toString(),
	};

	// Retry-After (seconds) when rate limited — RFC 7231 (reset is Unix ms)
	if (!result.success && result.reset) {
		const retryAfter = Math.max(
			1,
			Math.ceil((result.reset - Date.now()) / 1000),
		);
		headers["Retry-After"] = String(retryAfter);
	}

	return { success: result.success, headers };
}

/** Map a billing plan string to the corresponding rate-limit tier. Defaults to `"anonymous"`. */
export function getRateLimitTier(plan?: string): RateLimitTier {
	if (!plan) return "anonymous";

	const normalizedPlan = plan.toLowerCase();

	if (normalizedPlan.includes("enterprise")) return "enterprise";
	if (normalizedPlan.includes("pro")) return "pro";
	if (normalizedPlan.includes("free")) return "free";

	return "anonymous";
}
