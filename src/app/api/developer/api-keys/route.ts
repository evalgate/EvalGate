import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiKeys } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAdmin, requireAuthWithOrg } from '@/lib/autumn-server';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';
import { scopesForRole, ALL_SCOPES } from '@/lib/auth/scopes';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  return withRateLimit(request, async (req) => {
    try {
    const authResult = await requireAdmin(request);
    if (!authResult.authenticated) {
      const data = await authResult.response.json();
      return NextResponse.json(data, { status: authResult.response.status });
    }
    const organizationId = authResult.organizationId;

    const body = await request.json();
    
    // Security check: reject if userId provided in body
    if ('userId' in body || 'user_id' in body) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    const { name, scopes, expiresAt } = body;

    // Validate required fields
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ 
        error: "Name is required and must be a string",
        code: "MISSING_NAME" 
      }, { status: 400 });
    }

    if (!organizationId) {
      return NextResponse.json({ 
        error: "No organization membership found",
        code: "NO_ORG_MEMBERSHIP" 
      }, { status: 403 });
    }

    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      return NextResponse.json({ 
        error: "Scopes is required and must be a non-empty array",
        code: "MISSING_SCOPES" 
      }, { status: 400 });
    }

    // Validate scopes are strings
    if (!scopes.every(scope => typeof scope === 'string')) {
      return NextResponse.json({ 
        error: "All scopes must be strings",
        code: "INVALID_SCOPES" 
      }, { status: 400 });
    }

    // Scope issuance guardrails: reject * and non-canonical scopes
    const requestedScopes = scopes as string[];
    if (requestedScopes.includes('*')) {
      return NextResponse.json({ 
        error: "Wildcard scope '*' is not allowed",
        code: "INVALID_SCOPES" 
      }, { status: 400 });
    }
    const invalidScopes = requestedScopes.filter(s => !ALL_SCOPES.includes(s));
    if (invalidScopes.length > 0) {
      return NextResponse.json({ 
        error: `Invalid scopes: ${invalidScopes.join(', ')}`,
        code: "INVALID_SCOPES" 
      }, { status: 400 });
    }

    // Creator can only mint scopes they hold (subset of role scopes)
    const creatorScopes = new Set(scopesForRole(authResult.role));
    const excessScopes = requestedScopes.filter(s => !creatorScopes.has(s));
    if (excessScopes.length > 0) {
      return NextResponse.json({ 
        error: `Cannot grant scopes beyond your role: ${excessScopes.join(', ')}`,
        code: "INSUFFICIENT_ROLE" 
      }, { status: 403 });
    }

    // Validate expiresAt if provided
    if (expiresAt && typeof expiresAt !== 'string') {
      return NextResponse.json({ 
        error: "Expires at must be a string timestamp",
        code: "INVALID_EXPIRES_AT" 
      }, { status: 400 });
    }

    // Generate random API key in format: sk_test_[32 random characters]
    const randomBytes = crypto.randomBytes(24); // 24 bytes = 32 base64 characters
    const randomString = randomBytes.toString('base64')
      .replace(/\+/g, '')
      .replace(/\//g, '')
      .replace(/=/g, '')
      .substring(0, 32);
    
    const fullApiKey = `sk_test_${randomString}`;
    
    // Hash the full API key using SHA-256
    const keyHash = crypto.createHash('sha256').update(fullApiKey).digest('hex');
    
    // Get the prefix (first 8 characters)
    const keyPrefix = fullApiKey.substring(0, 8);

    // Insert the API key into database
    const newApiKey = await db.insert(apiKeys).values({
      userId: authResult.userId,
      organizationId,
      keyHash,
      keyPrefix,
      name: name.trim(),
      scopes: scopes,
      expiresAt: expiresAt || null,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date().toISOString()
    }).returning();

    if (newApiKey.length === 0) {
      return NextResponse.json({ 
        error: "Failed to create API key",
        code: "CREATE_FAILED" 
      }, { status: 500 });
    }

    // Return the full unhashed key ONCE (user cannot retrieve it again)
    return NextResponse.json({
      apiKey: fullApiKey,
      id: newApiKey[0].id,
      name: newApiKey[0].name,
      keyPrefix: newApiKey[0].keyPrefix
    }, { status: 201 });

  } catch (error: any) {
    if (error?.message?.includes('UNIQUE constraint failed') || error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return NextResponse.json({
        error: 'API key prefix collision — please retry',
        code: 'CONFLICT',
      }, { status: 409 });
    }
    logger.error({ error, route: '/api/developer/api-keys', method: 'POST' }, 'Error creating API key');
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
  });
}

export async function GET(request: NextRequest) {
  return withRateLimit(request, async (req) => {
    try {
    const authResult = await requireAuthWithOrg(request);
    if (!authResult.authenticated) {
      const data = await authResult.response.json();
      return NextResponse.json(data, { status: authResult.response.status });
    }

    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate limit and offset
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json({ 
        error: "Limit must be a positive number",
        code: "INVALID_LIMIT" 
      }, { status: 400 });
    }

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json({ 
        error: "Offset must be a non-negative number",
        code: "INVALID_OFFSET" 
      }, { status: 400 });
    }

    // Build query — scope by auth user + org
    const whereConditions = [
      eq(apiKeys.userId, authResult.userId),
      eq(apiKeys.organizationId, authResult.organizationId),
    ];

    // Execute query
    const results = await db.select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      organizationId: apiKeys.organizationId,
      keyPrefix: apiKeys.keyPrefix,
      name: apiKeys.name,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt
    })
      .from(apiKeys)
      .where(and(...whereConditions))
      .orderBy(desc(apiKeys.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    logger.error({ error, route: '/api/developer/api-keys', method: 'GET' }, 'Error fetching API keys');
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
  }, { customTier: 'free' });
}