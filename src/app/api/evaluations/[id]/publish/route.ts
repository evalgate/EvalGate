import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { evaluations } from "@/db/schema";
import { conflict, internalError, notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { SCOPES } from "@/lib/auth/scopes";
import { logger } from "@/lib/logger";

function generateShareId(): string {
  return randomBytes(5).toString("hex");
}

/**
 * POST /api/evaluations/[id]/publish
 * Publish an evaluation as a public demo
 */
export const POST = secureRoute(
  async (request: NextRequest, ctx: AuthContext, params) => {
    const { id } = params;

    // Verify evaluation exists and belongs to this organization
    const evaluation = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.id, parseInt(id, 10)))
      .limit(1);

    if (!evaluation[0]) {
      return notFound("Evaluation not found");
    }

    if (evaluation[0].organizationId !== ctx.organizationId) {
      return notFound("Evaluation not found");
    }

    const body = await request.json();

    const { exportData, customShareId } = body;

    if (!exportData) {
      return validationError("Export data is required");
    }

    // Generate or use custom share ID
    const shareId = customShareId || generateShareId();

    // Validate share ID format
    if (!/^[a-z0-9-]+$/.test(shareId)) {
      return validationError("Share ID must contain only lowercase letters, numbers, and hyphens");
    }

    // Define public exports directory
    // NOTE: Vercel has a read-only filesystem, so file writes only work locally or on self-hosted
    const publicDir = join(process.cwd(), "public", "exports", "public");

    // Ensure directory exists
    try {
      if (!existsSync(publicDir)) {
        await mkdir(publicDir, { recursive: true });
      }
    } catch (fsError) {
      logger.error("Filesystem write not supported (likely serverless)", {
        error: (fsError as Error).message,
      });
      return internalError(
        "Publishing is not available in serverless environments. Use self-hosted deployment or database-backed storage.",
      );
    }

    // Check if share ID already exists
    const filePath = join(publicDir, `${shareId}.json`);
    if (existsSync(filePath) && customShareId) {
      return conflict("This share ID is already taken. Please choose another.");
    }

    // Add metadata to export data
    const publishedData = {
      ...exportData,
      published_at: new Date().toISOString(),
      share_id: shareId,
      public: true,
    };

    // Write the file
    await writeFile(filePath, JSON.stringify(publishedData, null, 2), "utf-8");

    // Update the public demos index
    await updatePublicDemosIndex(shareId, publishedData);

    return NextResponse.json({
      success: true,
      shareId,
      shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL || ""}/share/${shareId}`,
    });
  },
  { requiredScopes: [SCOPES.EVAL_WRITE] },
);

/**
 * Update the public demos index file
 */
async function updatePublicDemosIndex(shareId: string, demoData: any) {
  try {
    const indexPath = join(process.cwd(), "public", "exports", "public", "index.json");

    let index: { demos: any[] } = { demos: [] };

    // Read existing index if it exists
    if (existsSync(indexPath)) {
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(indexPath, "utf-8");
      index = JSON.parse(content);
    }

    // Add or update demo in index
    const demoIndex = index.demos.findIndex((d) => d.id === shareId);
    const demoEntry = {
      id: shareId,
      name: demoData.evaluation?.name || "Untitled Evaluation",
      description: demoData.evaluation?.description || "",
      type: demoData.evaluation?.type || "unit_test",
      category: demoData.evaluation?.category,
      published_at: demoData.published_at,
      summary: demoData.summary,
    };

    if (demoIndex >= 0) {
      index.demos[demoIndex] = demoEntry;
    } else {
      index.demos.unshift(demoEntry); // Add to beginning
    }

    // Keep only last 100 demos
    index.demos = index.demos.slice(0, 100);

    // Write updated index
    await writeFile(indexPath, JSON.stringify(index, null, 2), "utf-8");
  } catch (error) {
    logger.error("Error updating demos index", { error: (error as Error).message });
    // Don't throw - index update is not critical
  }
}

/**
 * DELETE /api/evaluations/[id]/publish
 * Unpublish a demo
 */
export const DELETE = secureRoute(
  async (request: NextRequest, ctx: AuthContext, params) => {
    const { id } = params;

    // Verify evaluation exists and belongs to this organization
    const evaluation = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.id, parseInt(id, 10)))
      .limit(1);

    if (!evaluation[0]) {
      return notFound("Evaluation not found");
    }

    if (evaluation[0].organizationId !== ctx.organizationId) {
      return notFound("Evaluation not found");
    }

    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get("shareId");

    if (!shareId) {
      return validationError("Share ID is required");
    }

    const filePath = join(process.cwd(), "public", "exports", "public", `${shareId}.json`);

    if (!existsSync(filePath)) {
      return notFound("Demo not found");
    }

    // Delete the file
    const { unlink } = await import("node:fs/promises");
    await unlink(filePath);

    // Remove from index
    await removeFromPublicDemosIndex(shareId);

    return NextResponse.json({
      success: true,
      message: "Demo unpublished successfully",
    });
  },
  { requiredScopes: [SCOPES.EVAL_WRITE] },
);

async function removeFromPublicDemosIndex(shareId: string) {
  try {
    const indexPath = join(process.cwd(), "public", "exports", "public", "index.json");

    if (!existsSync(indexPath)) return;

    const { readFile, writeFile } = await import("node:fs/promises");
    const content = await readFile(indexPath, "utf-8");
    const index = JSON.parse(content);

    index.demos = index.demos.filter((d: any) => d.id !== shareId);

    await writeFile(indexPath, JSON.stringify(index, null, 2), "utf-8");
  } catch (error) {
    logger.error("Error removing from demos index", { error: (error as Error).message });
  }
}
