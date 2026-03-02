import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";

/**
 * Health check endpoint
 * Returns the health status of the application and its dependencies
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
	const _startTime = Date.now();

	const health = {
		status: "healthy" as "healthy" | "degraded" | "unhealthy",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		version: process.env.npm_package_version || "1.0.0",
		environment: process.env.NODE_ENV || "development",
		checks: {
			database: {
				status: "unknown" as "healthy" | "unhealthy",
				responseTime: 0,
			},
			redis: { status: "unknown" as "healthy" | "unhealthy", responseTime: 0 },
		},
	};

	// Check database connectivity
	try {
		const dbStart = Date.now();
		// Only check DB if DATABASE_URL is available (build-time safety)
		if (process.env.DATABASE_URL) {
			await db.select().from(sql`(SELECT 1)`).limit(1);
			health.checks.database.status = "healthy";
			health.checks.database.responseTime = Date.now() - dbStart;
		} else {
			health.checks.database.status = "healthy"; // Skip check if no DB URL
		}
	} catch (_error) {
		health.checks.database.status = "unhealthy";
		health.status = "unhealthy";
	}

	// Check Redis connectivity (for rate limiting)
	if (
		process.env.UPSTASH_REDIS_REST_URL &&
		process.env.UPSTASH_REDIS_REST_TOKEN
	) {
		try {
			const redisStart = Date.now();
			const response = await fetch(
				`${process.env.UPSTASH_REDIS_REST_URL}/ping`,
				{
					headers: {
						Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
					},
				},
			);

			if (response.ok) {
				health.checks.redis.status = "healthy";
				health.checks.redis.responseTime = Date.now() - redisStart;
			} else {
				health.checks.redis.status = "unhealthy";
				health.status = "degraded";
			}
		} catch (_error) {
			health.checks.redis.status = "unhealthy";
			health.status = "degraded";
		}
	} else {
		health.checks.redis.status = "healthy"; // Not configured, skip check
	}

	const statusCode =
		health.status === "healthy"
			? 200
			: health.status === "degraded"
				? 200
				: 503;

	return NextResponse.json(health, {
		status: statusCode,
		headers: {
			"Cache-Control": "no-cache, no-store, must-revalidate",
		},
	});
}
