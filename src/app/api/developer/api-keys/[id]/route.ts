import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { conflict, internalError, notFound, validationError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parse";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { auditService } from "@/lib/services/audit.service";
import { updateAPIKeyBodySchema } from "@/lib/validation";

export const PATCH = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const { id } = params;
    if (!id || Number.isNaN(parseInt(id, 10))) {
      return validationError("Valid ID is required");
    }

    const parsed = await parseBody(req, updateAPIKeyBodySchema);
    if (!parsed.ok) return parsed.response;

    const { name, scopes } = parsed.data;

    const existingKey = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, parseInt(id, 10)),
          eq(apiKeys.userId, ctx.userId),
          eq(apiKeys.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);

    if (existingKey.length === 0) {
      return notFound("API key not found");
    }

    const updateData: { name?: string; scopes?: string; updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    if (scopes !== undefined) {
      updateData.scopes = JSON.stringify(scopes);
    }

    const updated = await db
      .update(apiKeys)
      .set(updateData)
      .where(and(eq(apiKeys.id, parseInt(id, 10)), eq(apiKeys.userId, ctx.userId)))
      .returning();

    if (updated.length === 0) {
      return internalError("Failed to update API key");
    }

    const { keyHash, ...keyWithoutHash } = updated[0];

    const response = {
      ...keyWithoutHash,
      scopes:
        typeof keyWithoutHash.scopes === "string"
          ? JSON.parse(keyWithoutHash.scopes)
          : keyWithoutHash.scopes,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (_error: unknown) {
    return internalError();
  }
});

export const DELETE = secureRoute(async (_req: NextRequest, ctx: AuthContext, params) => {
  try {
    const { id } = params;
    if (!id || Number.isNaN(parseInt(id, 10))) {
      return validationError("Valid ID is required");
    }

    const existingKey = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, parseInt(id, 10)), eq(apiKeys.userId, ctx.userId)))
      .limit(1);

    if (existingKey.length === 0) {
      return notFound("API key not found");
    }

    if (existingKey[0].revokedAt) {
      return conflict("API key is already revoked");
    }

    const revokedAt = new Date();
    const revoked = await db
      .update(apiKeys)
      .set({ revokedAt })
      .where(and(eq(apiKeys.id, parseInt(id, 10)), eq(apiKeys.userId, ctx.userId)))
      .returning();

    if (revoked.length === 0) {
      return internalError("Failed to revoke API key");
    }

    await auditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "api_key_revoked",
      resourceType: "api_key",
      resourceId: id,
      metadata: { apiKeyId: parseInt(id, 10) },
    });

    return NextResponse.json(
      {
        message: "API key revoked successfully",
        revokedAt: revoked[0].revokedAt,
      },
      { status: 200 },
    );
  } catch (_error: unknown) {
    return internalError();
  }
});
