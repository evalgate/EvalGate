# Rate Limiting

The platform uses [Upstash Redis](https://upstash.com/) with `@upstash/ratelimit` for tiered rate limiting. Tiers: `anonymous` (30/min), `free` (200/min), `pro` (1000/min), `enterprise` (10000/min), `mcp` (100/min).

## Redis Fallback When Not Configured

When Redis is **not configured**—i.e., when `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` is missing—rate limiting is **disabled**.

- All requests are allowed (`success: true`)
- Response headers show `X-RateLimit-Limit: unlimited`, `X-RateLimit-Remaining: unlimited`, `X-RateLimit-Reset: 0`

This behavior is intentional for local and development environments where Redis may not be set up. **Production deployments should configure Upstash Redis** so rate limits are enforced.
