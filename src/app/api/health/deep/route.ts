import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { extractOrGenerateRequestId } from "@/lib/api/request-id";
import { secureRoute } from "@/lib/api/secure-route";

/**
 * Deep health check endpoint with timeout, version info, and admin-only access
 * Returns comprehensive health status with request tracking
 */
export const GET = secureRoute(
  async (req: NextRequest, _ctx) => {
    const startTime = Date.now();
    const requestId = extractOrGenerateRequestId(req as any);

    // Set timeout for all health checks (500ms total)
    const timeoutSignal = AbortSignal.timeout(500);

    const health = {
      status: "healthy" as "healthy" | "degraded" | "unhealthy",
      timestamp: new Date().toISOString(),
      requestId,
      version: {
        git: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
        spec: "v1",
        node: process.version,
      },
      checks: {
        database: { status: "unknown" as "healthy" | "unhealthy", responseTimeMs: 0 },
        redis: { status: "unknown" as "healthy" | "unhealthy" | "skipped", responseTimeMs: 0 },
        sentry: { status: "unknown" as "ok" | "skipped" },
      },
      totalTimeMs: 0,
    };

    // Database health check
    try {
      const dbStart = Date.now();
      await db.select().from(sql`(SELECT 1)`).limit(1);
      health.checks.database.status = "healthy";
      health.checks.database.responseTimeMs = Date.now() - dbStart;
    } catch (_error) {
      health.checks.database.status = "unhealthy";
      health.checks.database.responseTimeMs = Date.now() - startTime;
      health.status = "unhealthy";
    }

    // Redis health check (if configured)
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const redisStart = Date.now();
        const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          },
          signal: timeoutSignal,
        });

        if (response.ok) {
          health.checks.redis.status = "healthy";
          health.checks.redis.responseTimeMs = Date.now() - redisStart;
        } else {
          health.checks.redis.status = "unhealthy";
          health.checks.redis.responseTimeMs = Date.now() - redisStart;
          if (health.status === "healthy") health.status = "degraded";
        }
      } catch (_error) {
        health.checks.redis.status = "unhealthy";
        health.checks.redis.responseTimeMs = Date.now() - startTime;
        if (health.status === "healthy") health.status = "degraded";
      }
    } else {
      health.checks.redis.status = "skipped";
      health.checks.redis.responseTimeMs = 0;
    }

    // Sentry health check (noop - just verify DSN is configured)
    if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
      health.checks.sentry.status = "ok";
    } else {
      health.checks.sentry.status = "skipped";
    }

    health.totalTimeMs = Date.now() - startTime;

    // Determine overall status: DB down = unhealthy, Redis/Sentry down = degraded
    if (health.checks.database.status === "unhealthy") {
      health.status = "unhealthy";
    } else if (health.checks.redis.status === "unhealthy") {
      health.status = "degraded";
    }

    const statusCode = health.status === "unhealthy" ? 503 : 200;

    return NextResponse.json(health, {
      status: statusCode,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Request-ID": requestId,
      },
    });
  },
  { minRole: "admin" }, // Admin-only access
);
