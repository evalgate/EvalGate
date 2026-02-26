import { desc, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiUsageLogs, qualityScores, webhookDeliveries } from "@/db/schema";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";

/**
 * GET /api/metrics/slo
 *
 * Returns platform SLO values over a rolling 24-hour window.
 * Admin-only. All createdAt columns are integer (Unix epoch seconds).
 */
export const GET = secureRoute(
  async (_req: NextRequest, _ctx: AuthContext) => {
    // Unix epoch seconds for 24 h ago — compare against integer createdAt columns
    const windowStart = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);

    // ── p95 latency helpers ──────────────────────────────────────────────────

    async function publicLatencyP95(): Promise<number | null> {
      const countRows = await db
        .select({ total: sql<number>`count(*)` })
        .from(apiUsageLogs)
        .where(sql`${apiUsageLogs.userId} IS NULL AND ${apiUsageLogs.createdAt} >= ${windowStart}`);
      const total = countRows[0]?.total ?? 0;
      if (!total) return null;
      const offset = Math.max(0, Math.floor(total * 0.05));
      const rows = await db
        .select({ responseTimeMs: apiUsageLogs.responseTimeMs })
        .from(apiUsageLogs)
        .where(sql`${apiUsageLogs.userId} IS NULL AND ${apiUsageLogs.createdAt} >= ${windowStart}`)
        .orderBy(desc(apiUsageLogs.responseTimeMs))
        .limit(1)
        .offset(offset);
      return rows[0]?.responseTimeMs ?? null;
    }

    async function authedLatencyP95(): Promise<number | null> {
      const countRows = await db
        .select({ total: sql<number>`count(*)` })
        .from(apiUsageLogs)
        .where(
          sql`${apiUsageLogs.userId} IS NOT NULL AND ${apiUsageLogs.createdAt} >= ${windowStart}`,
        );
      const total = countRows[0]?.total ?? 0;
      if (!total) return null;
      const offset = Math.max(0, Math.floor(total * 0.05));
      const rows = await db
        .select({ responseTimeMs: apiUsageLogs.responseTimeMs })
        .from(apiUsageLogs)
        .where(
          sql`${apiUsageLogs.userId} IS NOT NULL AND ${apiUsageLogs.createdAt} >= ${windowStart}`,
        )
        .orderBy(desc(apiUsageLogs.responseTimeMs))
        .limit(1)
        .offset(offset);
      return rows[0]?.responseTimeMs ?? null;
    }

    // ── percentage helpers ───────────────────────────────────────────────────

    async function errorRate5xx(): Promise<number | null> {
      const [row] = await db
        .select({
          total: sql<number>`count(*)`,
          errors: sql<number>`count(case when ${apiUsageLogs.statusCode} >= 500 then 1 end)`,
        })
        .from(apiUsageLogs)
        .where(sql`${apiUsageLogs.createdAt} >= ${windowStart}`);
      if (!row?.total) return null;
      return (row.errors / row.total) * 100;
    }

    async function webhookSuccessRate(): Promise<number | null> {
      const [row] = await db
        .select({
          total: sql<number>`count(*)`,
          successes: sql<number>`count(case when ${webhookDeliveries.status} = 'success' then 1 end)`,
        })
        .from(webhookDeliveries)
        .where(sql`${webhookDeliveries.createdAt} >= ${windowStart}`);
      if (!row?.total) return null;
      return (row.successes / row.total) * 100;
    }

    async function evalGatePassRate(): Promise<number | null> {
      const [row] = await db
        .select({
          total: sql<number>`count(*)`,
          passed: sql<number>`count(case when ${qualityScores.score} >= 70 then 1 end)`,
        })
        .from(qualityScores)
        .where(sql`${qualityScores.createdAt} >= ${windowStart}`);
      if (!row?.total) return null;
      return (row.passed / row.total) * 100;
    }

    // ── run all queries in parallel ──────────────────────────────────────────

    const [pubP95, authP95, errRate, webhookRate, evalRate] = await Promise.all([
      publicLatencyP95(),
      authedLatencyP95(),
      errorRate5xx(),
      webhookSuccessRate(),
      evalGatePassRate(),
    ]);

    // ── build response ───────────────────────────────────────────────────────

    return NextResponse.json(
      {
        window: "24h",
        computedAt: new Date().toISOString(),
        slos: {
          apiLatencyPublicP95Ms: {
            value: pubP95,
            target: 500,
            breached: pubP95 !== null && pubP95 > 800,
          },
          apiLatencyAuthedP95Ms: {
            value: authP95,
            target: 1000,
            breached: authP95 !== null && authP95 > 2000,
          },
          errorRate5xxPct: {
            value: errRate,
            target: 1.0,
            breached: errRate !== null && errRate > 2.0,
          },
          webhookSuccessRatePct: {
            value: webhookRate,
            target: 95.0,
            breached: webhookRate !== null && webhookRate < 90.0,
          },
          evalGatePassRatePct: {
            value: evalRate,
            target: 70.0,
            breached: evalRate !== null && evalRate < 50.0,
          },
        },
      },
      {
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
      },
    );
  },
  { minRole: "admin" },
);
