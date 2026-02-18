import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiKeys } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, notFound, internalError, conflict } from '@/lib/api/errors';
import { parseBody } from '@/lib/api/parse';
import { updateAPIKeyBodySchema } from '@/lib/validation';

export const PATCH = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const { id } = params;
    if (!id || isNaN(parseInt(id))) {
      return validationError('Valid ID is required');
    }

    const parsed = await parseBody(req, updateAPIKeyBodySchema);
    if (!parsed.ok) return parsed.response;

    const { name, scopes } = parsed.data;

    const existingKey = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, parseInt(id)), eq(apiKeys.userId, ctx.userId), eq(apiKeys.organizationId, ctx.organizationId)))
      .limit(1);

    if (existingKey.length === 0) {
      return notFound('API key not found');
    }

    const updateData: { name?: string; scopes?: string; updatedAt: string } = {
      updatedAt: new Date().toISOString(),
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
      .where(and(eq(apiKeys.id, parseInt(id)), eq(apiKeys.userId, ctx.userId)))
      .returning();

    if (updated.length === 0) {
      return internalError('Failed to update API key');
    }

    const { keyHash, ...keyWithoutHash } = updated[0];

    const response = {
      ...keyWithoutHash,
      scopes: typeof keyWithoutHash.scopes === 'string'
        ? JSON.parse(keyWithoutHash.scopes)
        : keyWithoutHash.scopes
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    return internalError();
  }
});

export const DELETE = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const { id } = params;
    if (!id || isNaN(parseInt(id))) {
      return validationError('Valid ID is required');
    }

    const existingKey = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, parseInt(id)), eq(apiKeys.userId, ctx.userId)))
      .limit(1);

    if (existingKey.length === 0) {
      return notFound('API key not found');
    }

    if (existingKey[0].revokedAt) {
      return conflict('API key is already revoked');
    }

    const revokedAt = new Date().toISOString();
    const revoked = await db
      .update(apiKeys)
      .set({ revokedAt })
      .where(and(eq(apiKeys.id, parseInt(id)), eq(apiKeys.userId, ctx.userId)))
      .returning();

    if (revoked.length === 0) {
      return internalError('Failed to revoke API key');
    }

    return NextResponse.json(
      {
        message: 'API key revoked successfully',
        revokedAt: revoked[0].revokedAt
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return internalError();
  }
});
