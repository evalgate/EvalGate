# ADR-005: Upstash Redis for Rate Limiting

**Status:** Accepted
**Date:** 2026-02-28
**Decision makers:** Paul Cavallo

## Context

The platform needs rate limiting to protect API endpoints from abuse, enforce usage tiers (anonymous, free, pro, enterprise, MCP), and comply with fair-use policies. Rate limiting in a serverless environment (Vercel) poses unique challenges: there is no persistent in-process state between requests, and traditional Redis instances require persistent connections that don't map well to ephemeral function invocations.

Options considered:
1. **In-memory rate limiting** — simple but resets on every cold start and doesn't share state across function instances.
2. **Self-hosted Redis** — requires infrastructure management, connection pooling, and VPC configuration.
3. **Upstash Redis** — serverless Redis with HTTP-based access (no persistent connections), built-in rate limiting SDK, and a generous free tier.

## Decision

We selected Upstash Redis with the `@upstash/ratelimit` SDK for all rate limiting. The sliding window algorithm is used for smooth rate distribution. Rate limit state is shared across all serverless function instances via Upstash's globally distributed Redis.

A graceful degradation strategy is implemented: if Upstash is unreachable (network error, service outage), the system falls back to an in-memory rate limiter to avoid blocking all traffic. This fallback is per-instance and less accurate but prevents complete service disruption.

Tiers are configured as:
- **anonymous:** 30 requests/minute
- **free:** 200 requests/minute
- **pro:** 1,000 requests/minute
- **enterprise:** 10,000 requests/minute
- **mcp:** 100 requests/minute

## Consequences

**Easier:**
- Zero infrastructure management — Upstash is fully managed and serverless-native.
- HTTP-based access eliminates connection pooling complexity in serverless environments.
- Sliding window algorithm provides smoother rate distribution than fixed windows.
- Graceful degradation means a Redis outage doesn't become a platform outage.
- Per-tier configuration allows different rate limits for different user plans without code changes.

**More difficult:**
- Adds a network hop per rate-limited request (typically 1–5 ms to Upstash).
- Upstash free tier has usage limits that could be hit during load testing.
- The in-memory fallback is per-instance, so during degraded mode the effective rate limit is less accurate (each instance tracks independently).
- Vendor lock-in to Upstash's API, though the `@upstash/ratelimit` SDK could be swapped for a generic Redis client with moderate effort.
