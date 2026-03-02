import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { internalError, unauthorized } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/health
 *
 * Lightweight liveness + DB connectivity check for Vercel Cron.
 * Authenticated via CRON_SECRET header.
 *
 * vercel.json cron config:
 *   { "path": "/api/cron/health", "schedule": "* * * * *" }
 *
 * Returns:
 *   200 { ok: true, db: "ok", ts: "<ISO>" }
 *   500 { ok: false, error: "..." }
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
	const secret = process.env.CRON_SECRET;
	const auth = req.headers.get("authorization");

	if (!secret || auth !== `Bearer ${secret}`) {
		return unauthorized();
	}

	const ts = new Date().toISOString();

	try {
		// Only check DB connectivity if DATABASE_URL is available
		if (process.env.DATABASE_URL) {
			await db.execute(sql`SELECT 1`);
		}

		logger.info("Cron health check passed", { ts });
		return NextResponse.json({
			ok: true,
			db: process.env.DATABASE_URL ? "ok" : "skipped",
			ts,
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Health check failed";
		logger.error("Cron health check failed", { error: message, ts });
		return internalError(message);
	}
}
