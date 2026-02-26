import { and, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { evaluations, sharedExports } from "@/db/schema";
import { conflict, notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { SCOPES } from "@/lib/auth/scopes";
import { logger } from "@/lib/logger";
import { auditService } from "@/lib/services/audit.service";
import { computeExportHash, prepareExportForShare } from "@/lib/shared-exports";

const generateShareId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

/**
 * POST /api/evaluations/[id]/publish
 * Publish an evaluation as a public share link.
 * shareScope: "evaluation" (default) = stable link, content updates on republish
 * shareScope: "run" = new shareId each time, immutable snapshot
 */
export const POST = secureRoute(
  async (request: NextRequest, ctx: AuthContext, params) => {
    const { id } = params;
    const evaluationId = parseInt(id, 10);

    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.id, evaluationId))
      .limit(1);

    if (!evaluation || evaluation.organizationId !== ctx.organizationId) {
      return notFound("Evaluation not found");
    }

    const body = await request.json();
    const {
      exportData,
      customShareId,
      shareScope: rawShareScope,
      evaluationRunId: bodyRunId,
      expiresInDays,
    } = body;

    if (!exportData) {
      return validationError("Export data is required");
    }

    const shareScope = rawShareScope === "run" ? "run" : "evaluation";

    const expiresAt =
      typeof expiresInDays === "number" && expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

    // Single write path: sanitize and validate (no unsanitized export can be persisted)
    let sanitized: Record<string, unknown>;
    try {
      sanitized = prepareExportForShare(exportData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export data validation failed";
      return validationError(msg);
    }

    // Hash represents export content only — no share metadata in exportData
    const exportHash = computeExportHash(sanitized);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

    let shareId: string;
    let existing: (typeof sharedExports.$inferSelect)[];

    if (shareScope === "evaluation") {
      // Upsert: find existing by (orgId, evaluationId)
      existing = await db
        .select()
        .from(sharedExports)
        .where(
          and(
            eq(sharedExports.organizationId, ctx.organizationId),
            eq(sharedExports.shareScope, "evaluation"),
            eq(sharedExports.evaluationId, evaluationId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        const row = existing[0];
        if (customShareId && customShareId !== row.shareId) {
          const taken = await db
            .select()
            .from(sharedExports)
            .where(eq(sharedExports.shareId, customShareId))
            .limit(1);
          if (taken.length > 0) {
            return conflict("This share ID is already taken. Please choose another.");
          }
          shareId = customShareId;
        } else {
          shareId = customShareId || row.shareId;
        }
        const now = new Date();
        const runId = bodyRunId != null ? Number(bodyRunId) : null;
        await db
          .update(sharedExports)
          .set({
            shareId,
            exportData: sanitized,
            exportHash,
            evaluationRunId: Number.isFinite(runId) ? runId : row.evaluationRunId,
            revokedAt: null,
            revokedBy: null,
            updatedAt: now,
          })
          .where(eq(sharedExports.id, row.id));
      } else {
        shareId = customShareId || generateShareId();
        if (!/^[a-z0-9-]+$/.test(shareId)) {
          return validationError(
            "Share ID must contain only lowercase letters, numbers, and hyphens",
          );
        }
        const taken = await db
          .select()
          .from(sharedExports)
          .where(eq(sharedExports.shareId, shareId))
          .limit(1);
        if (taken.length > 0) {
          return conflict("This share ID is already taken. Please choose another.");
        }
        const runId = bodyRunId != null ? Number(bodyRunId) : null;
        await db.insert(sharedExports).values({
          shareId,
          organizationId: ctx.organizationId,
          evaluationId,
          evaluationRunId: Number.isFinite(runId) ? runId : null,
          shareScope: "evaluation",
          exportData: sanitized,
          exportHash,
          isPublic: true,
          createdAt: new Date(),
        });
      }
    } else {
      // Run scope: always create new
      const evaluationRunId = body.evaluationRunId ?? null;
      if (!evaluationRunId) {
        return validationError("evaluationRunId is required when shareScope is 'run'");
      }

      shareId = customShareId || generateShareId();
      if (!/^[a-z0-9-]+$/.test(shareId)) {
        return validationError(
          "Share ID must contain only lowercase letters, numbers, and hyphens",
        );
      }
      const taken = await db
        .select()
        .from(sharedExports)
        .where(eq(sharedExports.shareId, shareId))
        .limit(1);
      if (taken.length > 0) {
        return conflict("This share ID is already taken. Please choose another.");
      }

      await db.insert(sharedExports).values({
        shareId,
        organizationId: ctx.organizationId,
        evaluationId,
        evaluationRunId,
        shareScope: "run",
        exportData: sanitized,
        exportHash,
        isPublic: true,
        createdAt: new Date(),
        expiresAt: expiresAt ?? undefined,
      });
    }

    await auditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "share_link_created",
      resourceType: "shared_export",
      resourceId: shareId,
      metadata: {
        evaluationId,
        evaluationRunId: bodyRunId != null ? Number(bodyRunId) : null,
        shareScope,
        apiKeyId: ctx.apiKeyId,
      },
    });

    return NextResponse.json({
      success: true,
      shareScope,
      shareId,
      shareUrl: `${baseUrl}/share/${shareId}`,
    });
  },
  { requiredScopes: [SCOPES.EVAL_WRITE] },
);

/**
 * DELETE /api/evaluations/[id]/publish
 * Unpublish (soft revoke) a share. Requires shareId query param.
 */
export const DELETE = secureRoute(
  async (request: NextRequest, ctx: AuthContext, params) => {
    const { id } = params;

    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.id, parseInt(id, 10)))
      .limit(1);

    if (!evaluation || evaluation.organizationId !== ctx.organizationId) {
      return notFound("Evaluation not found");
    }

    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get("shareId");
    const revokedReason = searchParams.get("revokedReason") || undefined;

    if (!shareId) {
      return validationError("Share ID is required");
    }

    const [row] = await db
      .select()
      .from(sharedExports)
      .where(
        and(
          eq(sharedExports.shareId, shareId),
          eq(sharedExports.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);

    if (!row) {
      return notFound("Share not found");
    }

    const now = new Date();
    const revokedBy = ctx.userId ?? undefined;
    await db
      .update(sharedExports)
      .set({
        revokedAt: now,
        revokedBy: revokedBy ?? undefined,
        ...(revokedReason && { revokedReason }),
      })
      .where(eq(sharedExports.id, row.id));

    logger.info("Share revoked", { shareId, evaluationId: id, revokedBy });

    await auditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "share_link_revoked",
      resourceType: "shared_export",
      resourceId: shareId,
      metadata: {
        evaluationId: parseInt(id, 10),
        apiKeyId: ctx.apiKeyId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Share unpublished successfully",
    });
  },
  { requiredScopes: [SCOPES.EVAL_WRITE] },
);
