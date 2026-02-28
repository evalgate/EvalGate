import { type Duration, Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitTier = "free" | "pro" | "enterprise" | "anonymous" | "mcp";

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

export async function checkRateLimit(
	identifier: string,
	tier: RateLimitTier = "anonymous",
): Promise<{ success: boolean; headers: Record<string, string> }> {
	// If Redis is not configured, allow all requests (no rate limiting)
	if (!redis || Object.keys(rateLimiters).length === 0) {
		return {
			success: true,
			headers: {
				"X-RateLimit-Limit": "unlimited",
				"X-RateLimit-Remaining": "unlimited",
				"X-RateLimit-Reset": "0",
			},
		};
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

export function getRateLimitTier(plan?: string): RateLimitTier {
	if (!plan) return "anonymous";

	const normalizedPlan = plan.toLowerCase();

	if (normalizedPlan.includes("enterprise")) return "enterprise";
	if (normalizedPlan.includes("pro")) return "pro";
	if (normalizedPlan.includes("free")) return "free";

	return "anonymous";
}
