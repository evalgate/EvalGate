/**
 * Public report verification endpoint
 *
 * GET /api/r/[shareToken] — verify signature and return report
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sharedReports } from "@/db/schema";
import { notFound } from "@/lib/api/errors";
import { secureRoute } from "@/lib/api/secure-route";
import { deriveReportSecret, verifyReport } from "@/lib/reports/sign";

export const GET = secureRoute(
  async (_req: NextRequest, _ctx, params) => {
    const { shareToken } = params;

    const [report] = await db
      .select()
      .from(sharedReports)
      .where(eq(sharedReports.shareToken, shareToken))
      .limit(1);

    if (!report) return notFound("Report not found");

    // Check expiry
    if (report.expiresAt && new Date(report.expiresAt) < new Date()) {
      return notFound("This report has expired");
    }

    // Verify signature
    const secret = deriveReportSecret(report.organizationId);
    const valid = verifyReport(report.reportBody, report.signature, secret);

    // Increment view count (fire and forget)
    db.update(sharedReports)
      .set({ viewCount: (report.viewCount ?? 0) + 1 })
      .where(eq(sharedReports.id, report.id))
      .run();

    const parsedBody = JSON.parse(report.reportBody);

    return NextResponse.json({
      report: parsedBody,
      signatureValid: valid,
      viewCount: (report.viewCount ?? 0) + 1,
      createdAt: report.createdAt,
      expiresAt: report.expiresAt,
    });
  },
  { allowAnonymous: true, requireAuth: false, rateLimit: "anonymous" },
);
