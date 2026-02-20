import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
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
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ts = new Date().toISOString();

  try {
    // Minimal DB ping — single scalar query
    await db.run(sql`SELECT 1`);

    logger.info("Cron health check passed", { ts });
    return NextResponse.json({ ok: true, db: "ok", ts });
  } catch (err: any) {
    logger.error("Cron health check failed", { error: err.message, ts });
    return NextResponse.json({ ok: false, error: err.message, ts }, { status: 500 });
  }
}
