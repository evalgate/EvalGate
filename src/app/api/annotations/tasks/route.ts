import { and, desc, eq, like } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { annotationTasks } from "@/db/schema";
import { internalError, notFound, quotaExceeded, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { checkFeature, trackFeature } from "@/lib/autumn-server";
import { parsePaginationParams, sanitizeSearchInput } from "@/lib/validation";

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const { limit, offset } = parsePaginationParams(searchParams);
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    if (id) {
      if (Number.isNaN(parseInt(id, 10))) {
        return validationError("Valid ID is required");
      }

      const task = await db
        .select()
        .from(annotationTasks)
        .where(
          and(
            eq(annotationTasks.id, parseInt(id, 10)),
            eq(annotationTasks.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);

      if (task.length === 0) {
        return notFound("Annotation task not found");
      }

      return NextResponse.json(task[0]);
    }

    const conditions = [eq(annotationTasks.organizationId, ctx.organizationId)];

    if (status) {
      conditions.push(eq(annotationTasks.status, status));
    }

    if (search) {
      const safeSearch = sanitizeSearchInput(search);
      if (safeSearch) {
        conditions.push(like(annotationTasks.name, `%${safeSearch}%`));
      }
    }

    const results = await db
      .select()
      .from(annotationTasks)
      .where(and(...conditions))
      .orderBy(desc(annotationTasks.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results);
  } catch (_error: unknown) {
    return internalError();
  }
});

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const featureCheck = await checkFeature({
    userId: ctx.userId,
    featureId: "annotations",
    requiredBalance: 1,
  });

  if (!featureCheck.allowed) {
    return quotaExceeded("Annotations limit reached. Upgrade your plan to increase quota.", {
      featureId: "annotations",
      remaining: featureCheck.remaining || 0,
    });
  }

  const orgLimitCheck = await checkFeature({
    userId: ctx.userId,
    featureId: "annotations_per_project",
    requiredBalance: 1,
  });

  if (!orgLimitCheck.allowed) {
    return quotaExceeded(
      "You've reached your annotation task limit for this organization. Please upgrade your plan.",
    );
  }

  try {
    const body = await req.json();
    const { name, description, instructions, type, annotationSettings } = body;

    if (!name || !type) {
      return validationError("Name and type are required");
    }

    if (annotationSettings) {
      const { multipleAnnotators, qualityControl } = annotationSettings;

      if (multipleAnnotators) {
        const { annotatorsPerItem, minAgreementScore } = multipleAnnotators;
        if (annotatorsPerItem && (annotatorsPerItem < 1 || annotatorsPerItem > 10)) {
          return validationError("Annotators per item must be between 1 and 10");
        }
        if (minAgreementScore && (minAgreementScore < 0 || minAgreementScore > 100)) {
          return validationError("Minimum agreement score must be between 0 and 100");
        }
      }

      if (qualityControl) {
        const { minAnnotationsPerItem, maxAnnotationsPerAnnotator } = qualityControl;
        if (minAnnotationsPerItem && (minAnnotationsPerItem < 1 || minAnnotationsPerItem > 100)) {
          return validationError("Minimum annotations per item must be between 1 and 100");
        }
        if (
          maxAnnotationsPerAnnotator &&
          (maxAnnotationsPerAnnotator < 1 || maxAnnotationsPerAnnotator > 10000)
        ) {
          return validationError("Maximum annotations per annotator must be between 1 and 10000");
        }
      }
    }

    const now = new Date().toISOString();

    const inserted = await db
      .insert(annotationTasks)
      .values({
        name,
        description: description || null,
        type,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        status: "draft",
        annotationSettings: annotationSettings || {},
        createdAt: now,
        updatedAt: now,
        totalItems: 0,
        completedItems: 0,
      })
      .returning();

    if (inserted.length > 0) {
      await trackFeature({
        userId: ctx.userId,
        featureId: "annotations",
        value: 1,
      });

      await trackFeature({
        userId: ctx.userId,
        featureId: "annotations_per_project",
        value: 1,
      });
    }

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (_error: unknown) {
    return internalError("Failed to create annotation task");
  }
});

export const PUT = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || Number.isNaN(parseInt(id, 10))) {
      return validationError("Valid ID is required");
    }

    const body = await req.json();
    const { name, description, status, totalItems, completedItems } = body;

    const existing = await db
      .select()
      .from(annotationTasks)
      .where(
        and(
          eq(annotationTasks.id, parseInt(id, 10)),
          eq(annotationTasks.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      return notFound("Annotation task not found");
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (status !== undefined) updateData.status = status;
    if (totalItems !== undefined) updateData.totalItems = totalItems;
    if (completedItems !== undefined) updateData.completedItems = completedItems;

    const updated = await db
      .update(annotationTasks)
      .set(updateData)
      .where(
        and(
          eq(annotationTasks.id, parseInt(id, 10)),
          eq(annotationTasks.organizationId, ctx.organizationId),
        ),
      )
      .returning();

    return NextResponse.json(updated[0]);
  } catch (_error: unknown) {
    return internalError();
  }
});

export const DELETE = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || Number.isNaN(parseInt(id, 10))) {
      return validationError("Valid ID is required");
    }

    const existing = await db
      .select()
      .from(annotationTasks)
      .where(
        and(
          eq(annotationTasks.id, parseInt(id, 10)),
          eq(annotationTasks.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      return notFound("Annotation task not found");
    }

    await db
      .delete(annotationTasks)
      .where(
        and(
          eq(annotationTasks.id, parseInt(id, 10)),
          eq(annotationTasks.organizationId, ctx.organizationId),
        ),
      );

    return NextResponse.json({ message: "Annotation task deleted successfully" });
  } catch (_error: unknown) {
    return internalError();
  }
});
