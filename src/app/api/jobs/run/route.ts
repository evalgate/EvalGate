import { type NextRequest, NextResponse } from "next/server";
import { internalError, unauthorized } from "@/lib/api/errors";
import { runDueJobs } from "@/lib/jobs/runner";
import { logger } from "@/lib/logger";

/**
 * GET /api/jobs/run
 *
 * Cron endpoint — processes up to 10 due jobs per invocation.
 * Authenticated via CRON_SECRET header (not secureRoute — no session needed).
 * Must be GET because Vercel Cron always sends GET requests.
 *
 * Vercel Cron config (vercel.json):
 *   { "path": "/api/jobs/run", "schedule": "* * * * *" }
 */
export async function GET(req: NextRequest) {
	const secret = process.env.CRON_SECRET;
	const auth = req.headers.get("authorization");

	if (!secret || auth !== `Bearer ${secret}`) {
		return unauthorized();
	}

	try {
		const result = await runDueJobs();
		logger.info(
			"Job runner completed",
			result as unknown as Record<string, unknown>,
		);
		return NextResponse.json({ ok: true, ...result });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Job runner failed";
		logger.error("Job runner error", { error: message });
		return internalError(message);
	}
}
