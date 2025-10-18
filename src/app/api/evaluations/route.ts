import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { evaluations } from '@/db/schema';
import { eq, like, and, desc } from 'drizzle-orm';
import { requireFeature, trackFeature } from '@/lib/autumn-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const organizationId = searchParams.get('organizationId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    // Single evaluation by ID
    if (id) {
      if (isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const evaluation = await db.select()
        .from(evaluations)
        .where(eq(evaluations.id, parseInt(id)))
        .limit(1);

      if (evaluation.length === 0) {
        return NextResponse.json({ 
          error: 'Evaluation not found',
          code: 'NOT_FOUND' 
        }, { status: 404 });
      }

      return NextResponse.json(evaluation[0]);
    }

    // List evaluations with filtering
    const conditions = [];

    if (organizationId) {
      conditions.push(eq(evaluations.organizationId, parseInt(organizationId)));
    }

    if (type) {
      conditions.push(eq(evaluations.type, type));
    }

    if (status) {
      conditions.push(eq(evaluations.status, status));
    }

    if (search) {
      conditions.push(like(evaluations.name, `%${search}%`));
    }

    // Build the query with all conditions
    const query = db.select()
      .from(evaluations)
      .$dynamic();

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(evaluations.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error }, { status: 500 });
  }
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
      organizationId,
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

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
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
      organizationId: organizationId || null,
      status: "draft",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      executionSettings: executionSettings ? JSON.stringify(executionSettings) : null,
      modelSettings: modelSettings ? JSON.stringify(modelSettings) : null,
      customMetrics: customMetrics ? JSON.stringify(customMetrics) : null,
    }).returning().get()

    if (newEvaluation) {
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
    console.error("Error creating evaluation:", error)
    return NextResponse.json(
      { error: "Failed to create evaluation" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, type, status } = body;

    // Check if evaluation exists
    const existing = await db.select()
      .from(evaluations)
      .where(eq(evaluations.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Evaluation not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (type !== undefined) updateData.type = type.trim();
    if (status !== undefined) updateData.status = status;

    const updated = await db.update(evaluations)
      .set(updateData)
      .where(eq(evaluations.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const existing = await db.select()
      .from(evaluations)
      .where(eq(evaluations.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Evaluation not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    await db.delete(evaluations)
      .where(eq(evaluations.id, parseInt(id)));

    return NextResponse.json({ message: 'Evaluation deleted successfully' });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error }, { status: 500 });
  }
}