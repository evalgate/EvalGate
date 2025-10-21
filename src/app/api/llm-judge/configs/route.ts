import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { llmJudgeConfigs } from '@/db/schema';
import { eq, like, and, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  return withRateLimit(request, async (req) => {
    try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // Single record fetch
    if (id) {
      if (isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const config = await db.select()
        .from(llmJudgeConfigs)
        .where(eq(llmJudgeConfigs.id, parseInt(id)))
        .limit(1);

      if (config.length === 0) {
        return NextResponse.json({ 
          error: 'LLM judge config not found',
          code: 'CONFIG_NOT_FOUND' 
        }, { status: 404 });
      }

      return NextResponse.json(config[0], { status: 200 });
    }

    // List with pagination and filtering
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const organizationId = searchParams.get('organizationId');
    const model = searchParams.get('model');
    const search = searchParams.get('search');

    // Build filter conditions
    const conditions = [];

    if (organizationId) {
      conditions.push(eq(llmJudgeConfigs.organizationId, parseInt(organizationId)));
    }

    if (model) {
      conditions.push(eq(llmJudgeConfigs.model, model));
    }

    if (search) {
      conditions.push(like(llmJudgeConfigs.name, `%${search}%`));
    }

    // Build and execute the query with all conditions
    const results = await db.select()
      .from(llmJudgeConfigs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(llmJudgeConfigs.updatedAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    logger.error({ error, route: '/api/llm-judge/configs', method: 'GET' }, 'Error fetching LLM judge configs');
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
  }, { customTier: 'free' });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();

    // Security check: reject if userId provided in body
    if ('userId' in body || 'user_id' in body || 'createdBy' in body) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    const { name, organizationId, model, promptTemplate, criteria, settings } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ 
        error: "Name is required and must be a non-empty string",
        code: "MISSING_NAME" 
      }, { status: 400 });
    }

    if (!organizationId || typeof organizationId !== 'number') {
      return NextResponse.json({ 
        error: "Organization ID is required and must be a number",
        code: "MISSING_ORGANIZATION_ID" 
      }, { status: 400 });
    }

    if (!model || typeof model !== 'string' || model.trim() === '') {
      return NextResponse.json({ 
        error: "Model is required and must be a non-empty string",
        code: "MISSING_MODEL" 
      }, { status: 400 });
    }

    if (!promptTemplate || typeof promptTemplate !== 'string' || promptTemplate.trim() === '') {
      return NextResponse.json({ 
        error: "Prompt template is required and must be a non-empty string",
        code: "MISSING_PROMPT_TEMPLATE" 
      }, { status: 400 });
    }

    // Prepare insert data
    const now = new Date().toISOString();
    const insertData = {
      name: name.trim(),
      organizationId,
      model: model.trim(),
      promptTemplate: promptTemplate.trim(),
      criteria: criteria ? JSON.stringify(criteria) : null,
      settings: settings ? JSON.stringify(settings) : null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };

    const newConfig = await db.insert(llmJudgeConfigs)
      .values(insertData)
      .returning();

    return NextResponse.json(newConfig[0], { status: 201 });
  } catch (error) {
    logger.error({ error, route: '/api/llm-judge/configs', method: 'POST' }, 'Error creating LLM judge config');
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const body = await request.json();

    // Security check: reject if userId provided in body
    if ('userId' in body || 'user_id' in body || 'createdBy' in body) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    // Check if config exists
    const existing = await db.select()
      .from(llmJudgeConfigs)
      .where(eq(llmJudgeConfigs.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'LLM judge config not found',
        code: 'CONFIG_NOT_FOUND' 
      }, { status: 404 });
    }

    const { name, model, promptTemplate, criteria } = body;

    // Build update object with only provided fields
    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json({ 
          error: "Name must be a non-empty string",
          code: "INVALID_NAME" 
        }, { status: 400 });
      }
      updates.name = name.trim();
    }

    if (model !== undefined) {
      if (typeof model !== 'string' || model.trim() === '') {
        return NextResponse.json({ 
          error: "Model must be a non-empty string",
          code: "INVALID_MODEL" 
        }, { status: 400 });
      }
      updates.model = model.trim();
    }

    if (promptTemplate !== undefined) {
      if (typeof promptTemplate !== 'string' || promptTemplate.trim() === '') {
        return NextResponse.json({ 
          error: "Prompt template must be a non-empty string",
          code: "INVALID_PROMPT_TEMPLATE" 
        }, { status: 400 });
      }
      updates.promptTemplate = promptTemplate.trim();
    }

    if (criteria !== undefined) {
      updates.criteria = criteria ? JSON.stringify(criteria) : null;
    }

    const updated = await db.update(llmJudgeConfigs)
      .set(updates)
      .where(eq(llmJudgeConfigs.id, parseInt(id)))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ 
        error: 'LLM judge config not found',
        code: 'CONFIG_NOT_FOUND' 
      }, { status: 404 });
    }

    return NextResponse.json(updated[0], { status: 200 });
  } catch (error) {
    logger.error({ error, route: '/api/llm-judge/configs', method: 'PUT' }, 'Error updating LLM judge config');
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if config exists before deleting
    const existing = await db.select()
      .from(llmJudgeConfigs)
      .where(eq(llmJudgeConfigs.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'LLM judge config not found',
        code: 'CONFIG_NOT_FOUND' 
      }, { status: 404 });
    }

    const deleted = await db.delete(llmJudgeConfigs)
      .where(eq(llmJudgeConfigs.id, parseInt(id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ 
        error: 'LLM judge config not found',
        code: 'CONFIG_NOT_FOUND' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'LLM judge config deleted successfully',
      deleted: deleted[0] 
    }, { status: 200 });
  } catch (error) {
    logger.error({ error, route: '/api/llm-judge/configs', method: 'DELETE' }, 'Error deleting LLM judge config');
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}