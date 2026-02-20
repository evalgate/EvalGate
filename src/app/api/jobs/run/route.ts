import { type NextRequest, NextResponse } from "next/server";
import { runDueJobs } from "@/lib/jobs/runner";
import { logger } from "@/lib/logger";

/**
 * POST /api/jobs/run
 *
 * Cron endpoint — processes up to 10 due jobs per invocation.
 * Authenticated via CRON_SECRET header (not secureRoute — no session needed).
 *
 * Vercel Cron config (vercel.json):
 *   { "path": "/api/jobs/run", "schedule": "* * * * *" }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDueJobs();
    logger.info("Job runner completed", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    logger.error("Job runner error", { error: err.message });
    return NextResponse.json({ error: "Job runner failed" }, { status: 500 });
  }
}
