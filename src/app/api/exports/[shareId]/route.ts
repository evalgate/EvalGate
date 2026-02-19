/**
 * Public share export endpoint
 *
 * GET /api/exports/[shareId] — return ShareExportDTO (normalized)
 * 200: OK with payload
 * 304: Not Modified (If-None-Match matches ETag)
 * 404: Not found
 * 410: Gone (expired, revoked, or not public)
 */

import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sharedExports } from "@/db/schema";
import { secureRoute } from "@/lib/api/secure-route";
import { HASH_VERSION } from "@/lib/shared-exports/hash";

type ShareExportDTO = Record<string, unknown>;

function normalizeToShareExportDTO(
  exportData: Record<string, unknown>,
  shareId: string,
  shareScope: string,
  evaluationId: number | null,
  evaluationRunId: number | null,
  exportHash: string,
  createdAt: string,
  updatedAt: string | null,
  expiresAt: string | null,
): ShareExportDTO {
  const ev = (exportData.evaluation as Record<string, unknown>) ?? {};
  return {
    ...exportData,
    id: (ev.id as string) ?? shareId,
    name: (ev.name as string) ?? "Untitled Evaluation",
    description: (ev.description as string) ?? "",
    type: (exportData.type as string) ?? (ev.type as string) ?? "unit_test",
    category: (ev.category as string) ?? undefined,
    shareScope,
    sourceRunId: evaluationRunId ?? undefined,
    runId: evaluationRunId ?? undefined,
    evaluationId: evaluationId ?? undefined,
    exportHash,
    hashVersion: HASH_VERSION,
    privacyScrubbed: true,
    createdAt,
    updatedAt: updatedAt ?? createdAt,
    expiresAt: expiresAt ?? undefined,
  };
}

export const GET = secureRoute(
  async (req: NextRequest, _ctx, params) => {
    const { shareId } = params;

    const [row] = await db
      .select()
      .from(sharedExports)
      .where(eq(sharedExports.shareId, shareId))
      .limit(1);

    if (!row) {
      const res = NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Share not found" } },
        { status: 404 },
      );
      res.headers.set("Cache-Control", "public, max-age=30");
      res.headers.set("Vary", "Authorization");
      return res;
    }

    // 410 if expired, revoked, or not public — machine-readable codes for CLI/share page
    if (row.revokedAt) {
      const res = NextResponse.json(
        { error: { code: "SHARE_REVOKED", message: "This share link has been revoked" } },
        { status: 410 },
      );
      res.headers.set("Cache-Control", "public, max-age=30");
      res.headers.set("Vary", "Authorization");
      return res;
    }

    if (row.isPublic === false) {
      const res = NextResponse.json(
        { error: { code: "SHARE_UNAVAILABLE", message: "This share link is no longer available" } },
        { status: 410 },
      );
      res.headers.set("Cache-Control", "public, max-age=30");
      res.headers.set("Vary", "Authorization");
      return res;
    }

    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      const res = NextResponse.json(
        { error: { code: "SHARE_EXPIRED", message: "This share link has expired" } },
        { status: 410 },
      );
      res.headers.set("Cache-Control", "public, max-age=30");
      res.headers.set("Vary", "Authorization");
      return res;
    }

    const exportData = (row.exportData as Record<string, unknown>) ?? {};
    const dto = normalizeToShareExportDTO(
      exportData,
      row.shareId,
      row.shareScope,
      row.evaluationId,
      row.evaluationRunId,
      row.exportHash,
      row.createdAt,
      row.updatedAt,
      row.expiresAt,
    );

    const etag = `"${row.exportHash}"`;
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.trim() === etag) {
      const res304 = new NextResponse(null, { status: 304 });
      res304.headers.set("Cache-Control", `public, max-age=60, stale-while-revalidate=86400`);
      res304.headers.set("ETag", etag);
      res304.headers.set("Vary", "Authorization");
      return res304;
    }

    // Atomic view count increment: SET view_count = coalesce(view_count, 0) + 1
    // Single UPDATE is atomic in SQLite/libsql; parallel GETs increment correctly.
    try {
      await db
        .update(sharedExports)
        .set({ viewCount: sql`coalesce(${sharedExports.viewCount}, 0) + 1` })
        .where(eq(sharedExports.id, row.id));
    } catch {
      // Ignore - never affect 200 latency
    }

    const expiresAtDate = row.expiresAt ? new Date(row.expiresAt) : null;
    const now = new Date();
    const tenMinutes = 10 * 60 * 1000;
    const maxAge = expiresAtDate && expiresAtDate.getTime() - now.getTime() < tenMinutes ? 15 : 60;

    const res = NextResponse.json(dto);
    res.headers.set("Cache-Control", `public, max-age=${maxAge}, stale-while-revalidate=86400`);
    res.headers.set("ETag", etag);
    res.headers.set("X-Export-Hash", row.exportHash);
    res.headers.set("Vary", "Authorization");
    return res;
  },
  { allowAnonymous: true, requireAuth: false, rateLimit: "anonymous" },
);
