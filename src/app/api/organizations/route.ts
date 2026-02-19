import { desc, eq, like } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  annotationTasks,
  evaluations,
  organizationMembers,
  organizations,
  traces,
  webhooks,
  workflows,
} from "@/db/schema";
import { internalError, notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, type AuthOnlyContext, secureRoute } from "@/lib/api/secure-route";
import { parsePaginationParams, sanitizeSearchInput } from "@/lib/validation";

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (id) {
      if (!id || Number.isNaN(parseInt(id, 10))) {
        return validationError("Valid ID is required");
      }

      if (parseInt(id, 10) !== ctx.organizationId) {
        return notFound("Organization not found");
      }

      const organization = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, ctx.organizationId))
        .limit(1);

      if (organization.length === 0) {
        return notFound("Organization not found");
      }

      return NextResponse.json(organization[0], { status: 200 });
    }

    const { limit, offset } = parsePaginationParams(searchParams);
    const search = searchParams.get("search");

    const results = await db
      .select()
      .from(organizations)
      .where(search ? like(organizations.name, `%${sanitizeSearchInput(search)}%`) : undefined)
      .orderBy(desc(organizations.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results, { status: 200 });
  } catch (_error: unknown) {
    return internalError();
  }
});

export const POST = secureRoute(
  async (req: NextRequest, ctx: AuthOnlyContext) => {
    try {
      const body = await req.json();

      if ("userId" in body || "user_id" in body || "createdBy" in body) {
        return validationError("User ID cannot be provided in request body");
      }

      const { name } = body;

      if (!name || typeof name !== "string") {
        return validationError("Name is required and must be a string");
      }

      const sanitizedName = name.trim();

      if (sanitizedName.length === 0) {
        return validationError("Name cannot be empty");
      }

      const now = new Date();
      const newOrganization = await db
        .insert(organizations)
        .values({
          name: sanitizedName,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (newOrganization.length > 0) {
        await db.insert(organizationMembers).values({
          organizationId: newOrganization[0].id,
          userId: ctx.userId,
          role: "owner",
          createdAt: now,
        });
      }

      return NextResponse.json(newOrganization[0], { status: 201 });
    } catch (_error: unknown) {
      return internalError();
    }
  },
  { requireOrg: false },
);

export const PUT = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id || Number.isNaN(parseInt(id, 10))) {
      return validationError("Valid ID is required");
    }

    if (parseInt(id, 10) !== ctx.organizationId) {
      return notFound("Organization not found");
    }

    const body = await req.json();

    if ("userId" in body || "user_id" in body) {
      return validationError("User ID cannot be provided in request body");
    }

    const { name } = body;

    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return validationError("Name must be a non-empty string");
    }

    const updateData: {
      name?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    const updated = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, ctx.organizationId))
      .returning();

    return NextResponse.json(updated[0], { status: 200 });
  } catch (_error: unknown) {
    return internalError();
  }
});

export const DELETE = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id || Number.isNaN(parseInt(id, 10))) {
      return validationError("Valid ID is required");
    }

    const orgId = parseInt(id, 10);

    if (orgId !== ctx.organizationId) {
      return notFound("Organization not found");
    }

    const existing = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (existing.length === 0) {
      return notFound("Organization not found");
    }

    await db.delete(webhooks).where(eq(webhooks.organizationId, orgId));
    await db.delete(annotationTasks).where(eq(annotationTasks.organizationId, orgId));
    await db.delete(traces).where(eq(traces.organizationId, orgId));
    await db.delete(workflows).where(eq(workflows.organizationId, orgId));
    await db.delete(evaluations).where(eq(evaluations.organizationId, orgId));
    await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgId));

    const _deleted = await db.delete(organizations).where(eq(organizations.id, orgId)).returning();

    return NextResponse.json(
      {
        message: "Organization deleted successfully",
      },
      { status: 200 },
    );
  } catch (_error: unknown) {
    return internalError();
  }
});
