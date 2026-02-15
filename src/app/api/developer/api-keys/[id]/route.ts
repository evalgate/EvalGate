import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiKeys } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Extract and validate ID
    const { id } = await params;
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, scopes } = body;

    // Validate at least one field is being updated
    if (name === undefined && scopes === undefined) {
      return NextResponse.json(
        { error: 'At least one field (name or scopes) must be provided', code: 'NO_FIELDS_TO_UPDATE' },
        { status: 400 }
      );
    }

    // Validate scopes format if provided
    if (scopes !== undefined && !Array.isArray(scopes)) {
      return NextResponse.json(
        { error: 'Scopes must be an array', code: 'INVALID_SCOPES_FORMAT' },
        { status: 400 }
      );
    }

    // Check if API key exists and belongs to user
    const existingKey = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, parseInt(id)), eq(apiKeys.userId, user.id)))
      .limit(1);

    if (existingKey.length === 0) {
      return NextResponse.json(
        { error: 'API key not found', code: 'KEY_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Prepare update object
    const updateData: Record<string, any> = {};
    
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json(
          { error: 'Name must be a non-empty string', code: 'INVALID_NAME' },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (scopes !== undefined) {
      // Validate each scope is a string
      if (!scopes.every((scope: any) => typeof scope === 'string')) {
        return NextResponse.json(
          { error: 'All scopes must be strings', code: 'INVALID_SCOPE_TYPE' },
          { status: 400 }
        );
      }
      updateData.scopes = JSON.stringify(scopes);
    }

    // Update the API key
    const updated = await db
      .update(apiKeys)
      .set(updateData)
      .where(and(eq(apiKeys.id, parseInt(id)), eq(apiKeys.userId, user.id)))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: 'Failed to update API key', code: 'UPDATE_FAILED' },
        { status: 500 }
      );
    }

    // Return updated key without keyHash
    const { keyHash, ...keyWithoutHash } = updated[0];
    
    // Parse scopes back to array for response
    const response = {
      ...keyWithoutHash,
      scopes: typeof keyWithoutHash.scopes === 'string' 
        ? JSON.parse(keyWithoutHash.scopes) 
        : keyWithoutHash.scopes
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Extract and validate ID
    const { id } = await params;
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Check if API key exists and belongs to user
    const existingKey = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, parseInt(id)), eq(apiKeys.userId, user.id)))
      .limit(1);

    if (existingKey.length === 0) {
      return NextResponse.json(
        { error: 'API key not found', code: 'KEY_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if already revoked
    if (existingKey[0].revokedAt) {
      return NextResponse.json(
        { error: 'API key is already revoked', code: 'ALREADY_REVOKED' },
        { status: 400 }
      );
    }

    // Soft delete by setting revokedAt timestamp
    const revokedAt = new Date().toISOString();
    const revoked = await db
      .update(apiKeys)
      .set({ revokedAt })
      .where(and(eq(apiKeys.id, parseInt(id)), eq(apiKeys.userId, user.id)))
      .returning();

    if (revoked.length === 0) {
      return NextResponse.json(
        { error: 'Failed to revoke API key', code: 'REVOKE_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'API key revoked successfully',
        revokedAt: revoked[0].revokedAt
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}