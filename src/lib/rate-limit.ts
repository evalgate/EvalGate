import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Duration } from "@upstash/ratelimit";

type RateLimitTier = "free" | "pro" | "enterprise" | "anonymous";

// Rate limit configurations for different tiers
const RATE_LIMITS: Record<RateLimitTier, { requests: number; window: Duration }> = {
  free: { requests: 100, window: '1 m' },
  pro: { requests: 1000, window: '1 m' },
  enterprise: { requests: 10000, window: '1 m' },
  anonymous: { requests: 10, window: '1 m' },
};

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Create rate limiters for each tier
const rateLimiters: Record<string, Ratelimit> = {};

Object.entries(RATE_LIMITS).forEach(([tier, config]) => {
  rateLimiters[tier] = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    analytics: true,
    prefix: `@upstash/ratelimit_${tier}`,
  });
});

export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = 'anonymous'
): Promise<{ success: boolean; headers: Record<string, string> }> {
  // Get the appropriate rate limiter for the tier
  const rateLimiter = rateLimiters[tier] || rateLimiters.anonymous;
  
  // Check rate limit
  const result = await rateLimiter.limit(identifier);
  
  return {
    success: result.success,
    headers: {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.reset.toString(),
    },
  };
}

export function getRateLimitTier(plan?: string): RateLimitTier {
  if (!plan) return 'anonymous';
  
  const normalizedPlan = plan.toLowerCase();
  
  if (normalizedPlan.includes('enterprise')) return 'enterprise';
  if (normalizedPlan.includes('pro')) return 'pro';
  if (normalizedPlan.includes('free')) return 'free';
  
  return 'anonymous';
}
