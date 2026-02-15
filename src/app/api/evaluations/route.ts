import { NextRequest, NextResponse } from 'next/server';
import { requireFeature, requireAuthWithOrg, trackFeature } from '@/lib/autumn-server';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';
import { evaluationService } from '@/lib/services/evaluation.service';
import { validateRequest } from '@/lib/validation';
import { z } from 'zod';
import { db } from '@/db';
import { evaluations, testCases, organizationMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  return withRateLimit(request, async (req) => {
    try {
      // Authenticate and resolve org from user membership (app-layer RLS)
      const authResult = await requireAuthWithOrg(request);
      if (!authResult.authenticated) {
        const data = await authResult.response.json();
        return NextResponse.json(data, { status: authResult.response.status });
      }

      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      const organizationId = authResult.organizationId;

      // Single evaluation by ID
      if (id) {
        const evaluationId = parseInt(id);
        if (isNaN(evaluationId)) {
          return NextResponse.json({ 
            error: "Valid ID is required",
            code: "INVALID_ID" 
          }, { status: 400 });
        }

        const evaluation = await evaluationService.getById(evaluationId, organizationId);

        if (!evaluation) {
          return NextResponse.json({ 
            error: 'Evaluation not found',
            code: 'NOT_FOUND' 
          }, { status: 404 });
        }

        return NextResponse.json(evaluation, {
          headers: {
            'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
          }
        });
      }

      // List evaluations
      const parsedLimit = parseInt(searchParams.get('limit') || '50');
      const parsedOffset = parseInt(searchParams.get('offset') || '0');
      const limit = Math.min(isNaN(parsedLimit) ? 50 : parsedLimit, 100);
      const offset = isNaN(parsedOffset) ? 0 : parsedOffset;
      const status = searchParams.get('status') as 'draft' | 'active' | 'archived' | null;

      const results = await evaluationService.list(organizationId, {
        limit,
        offset,
        status: status || undefined,
      });

      return NextResponse.json(results, {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
        }
      });
    } catch (error: any) {
      logger.error('Error fetching evaluations', { 
        error: error.message,
        route: '/api/evaluations',
        method: 'GET' 
      });
      return NextResponse.json({ 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR' 
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}

export async function POST(request: Request) {
  // Step 1: Check authentication and global feature allowance
  const featureCheck = await requireFeature(request, 'projects', 1);
  
  if (!featureCheck.allowed) {
    return featureCheck.response;
  }

  const userId = featureCheck.userId;

  try {
    const body = await request.json()
    const { 
      name, 
      description, 
      type,
      executionSettings, 
      modelSettings, 
      customMetrics 
    } = body

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      )
    }

    // Derive organizationId from the authenticated user's membership (app-layer RLS)
    const memberships = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId))
      .limit(1);
    const organizationId = memberships.length > 0 ? memberships[0].organizationId : null;

    if (!organizationId) {
      return NextResponse.json(
        { error: "No organization membership found" },
        { status: 403 }
      )
    }

    // Step 2: Check per-organization evaluation limit
    const orgLimitCheck = await requireFeature(request, 'evals_per_project', 1);
    
    if (!orgLimitCheck.allowed) {
      return NextResponse.json({
        error: "You've reached your evaluation limit for this organization. Please upgrade your plan.",
        code: "ORGANIZATION_EVAL_LIMIT_REACHED"
      }, { status: 402 });
    }

    // Validate executionSettings if provided
    if (executionSettings) {
      const { batchSize, parallelRuns, timeout } = executionSettings
      if (batchSize && (batchSize < 1 || batchSize > 1000)) {
        return NextResponse.json(
          { error: "Batch size must be between 1 and 1000" },
          { status: 400 }
        )
      }
      if (parallelRuns && (parallelRuns < 1 || parallelRuns > 100)) {
        return NextResponse.json(
          { error: "Parallel runs must be between 1 and 100" },
          { status: 400 }
        )
      }
      if (timeout && (timeout < 1 || timeout > 3600)) {
        return NextResponse.json(
          { error: "Timeout must be between 1 and 3600 seconds" },
          { status: 400 }
        )
      }
    }

    // Validate modelSettings if provided
    if (modelSettings) {
      const { temperature, maxTokens, topP } = modelSettings
      if (temperature && (temperature < 0 || temperature > 2)) {
        return NextResponse.json(
          { error: "Temperature must be between 0 and 2" },
          { status: 400 }
        )
      }
      if (maxTokens && (maxTokens < 1 || maxTokens > 128000)) {
        return NextResponse.json(
          { error: "Max tokens must be between 1 and 128000" },
          { status: 400 }
        )
      }
      if (topP && (topP < 0 || topP > 1)) {
        return NextResponse.json(
          { error: "Top P must be between 0 and 1" },
          { status: 400 }
        )
      }
    }

    const now = new Date().toISOString()

    const newEvaluation = await db.insert(evaluations).values({
      name,
      description,
      type,
      organizationId,
      status: "draft",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      executionSettings: executionSettings ? JSON.stringify(executionSettings) : null,
      modelSettings: modelSettings ? JSON.stringify(modelSettings) : null,
      customMetrics: customMetrics ? JSON.stringify(customMetrics) : null,
    }).returning().get()

    // Extract and persist test cases from template config
    if (newEvaluation) {
      try {
        const templates = body.config?.templates || body.templates || [];
        const allTestCases: Array<{ name: string; input: string; expectedOutput?: string; metadata?: any }> = [];

        // Collect test cases from templates
        for (const template of templates) {
          const tcs = template.testCases || template.template?.testCases || [];
          for (const tc of tcs) {
            allTestCases.push({
              name: tc.name || tc.label || `Test Case`,
              input: typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input || ''),
              expectedOutput: typeof tc.expectedOutput === 'string' ? tc.expectedOutput : JSON.stringify(tc.expectedOutput || ''),
              metadata: tc.metadata ? JSON.stringify(tc.metadata) : null,
            });
          }
        }

        // Also check for top-level testCases array
        const topLevelCases = body.testCases || [];
        for (const tc of topLevelCases) {
          allTestCases.push({
            name: tc.name || `Test Case`,
            input: typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input || ''),
            expectedOutput: typeof tc.expectedOutput === 'string' ? tc.expectedOutput : JSON.stringify(tc.expectedOutput || ''),
            metadata: tc.metadata ? JSON.stringify(tc.metadata) : null,
          });
        }

        if (allTestCases.length > 0) {
          await db.insert(testCases).values(
            allTestCases.map((tc) => ({
              evaluationId: newEvaluation.id,
              name: tc.name,
              input: tc.input,
              expectedOutput: tc.expectedOutput || null,
              metadata: tc.metadata || null,
              createdAt: now,
            }))
          );
          logger.info('Test cases persisted from templates', { 
            evaluationId: newEvaluation.id, 
            count: allTestCases.length 
          });
        }
      } catch (tcError) {
        logger.warn('Failed to persist template test cases', { error: tcError, evaluationId: newEvaluation.id });
      }

      // Track the evaluation creation event
      await trackFeature({
        userId,
        featureId: 'evaluation_created',
        value: 1,
        idempotencyKey: `evaluation-${newEvaluation.id}-${Date.now()}`
      });

      // Track project usage if organization ID is present
      if (organizationId) {
        await trackFeature({
          userId,
          featureId: 'projects',
          value: 1,
          idempotencyKey: `project-${organizationId}-${Date.now()}`
        });

        await trackFeature({
          userId,
          featureId: 'evals_per_project',
          value: 1,
          idempotencyKey: `eval-org-${organizationId}-${newEvaluation.id}-${Date.now()}`
        });
      }
    }

    return NextResponse.json(newEvaluation, { status: 201 })
  } catch (error) {
    logger.error({ error, route: '/api/evaluations', method: 'POST' }, 'Error creating evaluation')
    return NextResponse.json(
      { error: "Failed to create evaluation" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate and resolve org from user membership (app-layer RLS)
    const authResult = await requireAuthWithOrg(request);
    if (!authResult.authenticated) {
      const data = await authResult.response.json();
      return NextResponse.json(data, { status: authResult.response.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const organizationId = authResult.organizationId;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const body = await request.json();
    
    // Validate request body
    const updateSchema = z.object({
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      status: z.enum(['draft', 'active', 'archived']).optional(),
    });

    const validation = updateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
      }, { status: 400 });
    }

    const updated = await evaluationService.update(
      parseInt(id),
      organizationId,
      validation.data
    );

    if (!updated) {
      return NextResponse.json({ 
        error: 'Evaluation not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    logger.error('Error updating evaluation', {
      error: error.message,
      route: '/api/evaluations',
      method: 'PUT'
    });
    return NextResponse.json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate and resolve org from user membership (app-layer RLS)
    const authResult = await requireAuthWithOrg(request);
    if (!authResult.authenticated) {
      const data = await authResult.response.json();
      return NextResponse.json(data, { status: authResult.response.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const organizationId = authResult.organizationId;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const deleted = await evaluationService.delete(parseInt(id), organizationId);

    if (!deleted) {
      return NextResponse.json({ 
        error: 'Evaluation not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Evaluation deleted successfully',
      success: true 
    });
  } catch (error: any) {
    logger.error('Error deleting evaluation', {
      error: error.message,
      route: '/api/evaluations',
      method: 'DELETE'
    });
    return NextResponse.json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR' 
    }, { status: 500 });
  }
}