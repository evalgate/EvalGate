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
import { apiError } from "@/lib/api/errors";
import { getRequestId } from "@/lib/api/request-id";
import { secureRoute } from "@/lib/api/secure-route";
import { HASH_VERSION } from "@/lib/shared-exports/hash";

function shareError(
	code: "NOT_FOUND" | "SHARE_REVOKED" | "SHARE_EXPIRED" | "SHARE_UNAVAILABLE",
	message: string,
	status: number,
) {
	const res = apiError(code, message, status);
	res.headers.set("Cache-Control", "public, max-age=30");
	res.headers.set("Vary", "Authorization");
	return res;
}

type ShareExportDTO = Record<string, unknown>;

function toISOStringOrNull(
	val: Date | string | null | undefined,
): string | undefined {
	if (!val) return undefined;
	return val instanceof Date ? val.toISOString() : val;
}

function normalizeToShareExportDTO(
	exportData: Record<string, unknown>,
	shareId: string,
	shareScope: string,
	evaluationId: number | null,
	evaluationRunId: number | null,
	exportHash: string,
	createdAt: Date | string,
	updatedAt: Date | string | null,
	expiresAt: Date | string | null,
): ShareExportDTO {
	const ev = (exportData.evaluation as Record<string, unknown>) ?? {};
	const createdAtStr =
		createdAt instanceof Date ? createdAt.toISOString() : createdAt;
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
		createdAt: createdAtStr,
		updatedAt: toISOStringOrNull(updatedAt) ?? createdAtStr,
		expiresAt: toISOStringOrNull(expiresAt),
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
			return shareError("NOT_FOUND", "Share not found", 404);
		}

		// 410 if expired, revoked, or not public — machine-readable codes for CLI/share page
		if (row.revokedAt) {
			return shareError(
				"SHARE_REVOKED",
				"This share link has been revoked",
				410,
			);
		}

		if (row.isPublic === false) {
			return shareError(
				"SHARE_UNAVAILABLE",
				"This share link is no longer available",
				410,
			);
		}

		const expiresAtDate =
			row.expiresAt instanceof Date
				? row.expiresAt
				: row.expiresAt
					? new Date(row.expiresAt)
					: null;
		if (expiresAtDate && expiresAtDate < new Date()) {
			return shareError("SHARE_EXPIRED", "This share link has expired", 410);
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
			return new Response(null, {
				status: 304,
				headers: {
					"Cache-Control": "public, max-age=60, stale-while-revalidate=86400",
					ETag: etag,
					Vary: "Authorization",
				},
			});
		}

		// Atomic view count increment: SET view_count = coalesce(view_count, 0) + 1
		// Single UPDATE is atomic in PostgreSQL; parallel GETs increment correctly.
		try {
			await db
				.update(sharedExports)
				.set({ viewCount: sql`coalesce(${sharedExports.viewCount}, 0) + 1` })
				.where(eq(sharedExports.id, row.id));
		} catch {
			// Ignore - never affect 200 latency
		}

		const expiresAtForCache =
			row.expiresAt instanceof Date
				? row.expiresAt
				: row.expiresAt
					? new Date(row.expiresAt)
					: null;
		const now = new Date();
		const tenMinutes = 10 * 60 * 1000;
		const maxAge =
			expiresAtForCache &&
			expiresAtForCache.getTime() - now.getTime() < tenMinutes
				? 15
				: 60;

		const res = NextResponse.json({ ...dto, requestId: getRequestId() });
		res.headers.set(
			"Cache-Control",
			`public, max-age=${maxAge}, stale-while-revalidate=86400`,
		);
		res.headers.set("ETag", etag);
		res.headers.set("X-Export-Hash", row.exportHash);
		res.headers.set("Vary", "Authorization");
		return res;
	},
	{ allowAnonymous: true, requireAuth: false, rateLimit: "anonymous" },
);
