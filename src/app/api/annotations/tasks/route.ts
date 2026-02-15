import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { annotationTasks } from '@/db/schema';
import { eq, like, and, desc } from 'drizzle-orm';
import { requireFeature, requireAuthWithOrg, trackFeature } from '@/lib/autumn-server';
import { sanitizeSearchInput } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    // Authenticate and resolve org from user membership (app-layer RLS)
    const authResult = await requireAuthWithOrg(request);
    if (!authResult.authenticated) {
      const data = await authResult.response.json();
      return NextResponse.json(data, { status: authResult.response.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    // Single task by ID — scoped to user's org
    if (id) {
      if (isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const task = await db.select()
        .from(annotationTasks)
        .where(and(eq(annotationTasks.id, parseInt(id)), eq(annotationTasks.organizationId, authResult.organizationId)))
        .limit(1);

      if (task.length === 0) {
        return NextResponse.json({ 
          error: 'Annotation task not found',
          code: 'NOT_FOUND' 
        }, { status: 404 });
      }

      return NextResponse.json(task[0]);
    }

    // List tasks with filtering — scoped to user's org
    const conditions = [eq(annotationTasks.organizationId, authResult.organizationId)];

    if (status) {
      conditions.push(eq(annotationTasks.status, status));
    }

    if (search) {
      const safeSearch = sanitizeSearchInput(search);
      if (safeSearch) {
        conditions.push(like(annotationTasks.name, `%${safeSearch}%`));
      }
    }

    const results = await db.select()
      .from(annotationTasks)
      .where(and(...conditions))
      .orderBy(desc(annotationTasks.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Step 1: Check authentication and global "annotations" feature quota
    const authResult = await requireFeature(request as unknown as NextRequest, "annotations");
    if (!authResult.allowed) {
      return authResult.response || NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const userId = authResult.userId;

    const body = await request.json()
    const { 
      name, 
      description, 
      instructions, 
      type,
      annotationSettings 
    } = body

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      )
    }

    // Derive organizationId from the authenticated user's membership (handled by requireFeature -> requireAuth above)
    const { organizationMembers: orgMembers } = await import('@/db/schema');
    const { eq: eqOp } = await import('drizzle-orm');
    const memberships = await db
      .select()
      .from(orgMembers)
      .where(eqOp(orgMembers.userId, userId))
      .limit(1);
    const organizationId = memberships.length > 0 ? memberships[0].organizationId : null;

    if (!organizationId) {
      return NextResponse.json(
        { error: "No organization membership found" },
        { status: 403 }
      )
    }

    // Step 2: Check per-organization annotation limit
    const orgLimitCheck = await requireFeature(request as unknown as NextRequest, 'annotations_per_project', 1);
    
    if (!orgLimitCheck.allowed) {
      return NextResponse.json({
        error: "You've reached your annotation task limit for this organization. Please upgrade your plan.",
        code: "ORGANIZATION_ANNOTATION_LIMIT_REACHED"
      }, { status: 402 });
    }

    // Validate annotationSettings if provided
    if (annotationSettings) {
      const { multipleAnnotators, qualityControl } = annotationSettings
      
      if (multipleAnnotators) {
        const { annotatorsPerItem, minAgreementScore } = multipleAnnotators
        if (annotatorsPerItem && (annotatorsPerItem < 1 || annotatorsPerItem > 10)) {
          return NextResponse.json(
            { error: "Annotators per item must be between 1 and 10" },
            { status: 400 }
          )
        }
        if (minAgreementScore && (minAgreementScore < 0 || minAgreementScore > 100)) {
          return NextResponse.json(
            { error: "Minimum agreement score must be between 0 and 100" },
            { status: 400 }
          )
        }
      }

      if (qualityControl) {
        const { minAnnotationsPerItem, maxAnnotationsPerAnnotator } = qualityControl
        if (minAnnotationsPerItem && (minAnnotationsPerItem < 1 || minAnnotationsPerItem > 100)) {
          return NextResponse.json(
            { error: "Minimum annotations per item must be between 1 and 100" },
            { status: 400 }
          )
        }
        if (maxAnnotationsPerAnnotator && (maxAnnotationsPerAnnotator < 1 || maxAnnotationsPerAnnotator > 10000)) {
          return NextResponse.json(
            { error: "Maximum annotations per annotator must be between 1 and 10000" },
            { status: 400 }
          )
        }
      }
    }

    const now = new Date().toISOString()

    const result = await db.insert(annotationTasks).values({
      name,
      description: description || null,
      type,
      organizationId,
      createdBy: userId,
      status: 'draft',
      annotationSettings: annotationSettings || {},
      createdAt: now,
      updatedAt: now,
      totalItems: 0,
      completedItems: 0
    })

    // Track feature usage
    if (result.lastInsertRowid) {
      await trackFeature({
        userId,
        featureId: 'annotations',
        value: 1
      });

      await trackFeature({
        userId,
        featureId: 'annotations_per_project',
        value: 1
      });
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Error creating annotation task:", error)
    return NextResponse.json(
      { error: "Failed to create annotation task" },
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

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, status, totalItems, completedItems } = body;

    // Scope to user's org
    const existing = await db.select()
      .from(annotationTasks)
      .where(and(eq(annotationTasks.id, parseInt(id)), eq(annotationTasks.organizationId, authResult.organizationId)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Annotation task not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (status !== undefined) updateData.status = status;
    if (totalItems !== undefined) updateData.totalItems = totalItems;
    if (completedItems !== undefined) updateData.completedItems = completedItems;

    const updated = await db.update(annotationTasks)
      .set(updateData)
      .where(and(eq(annotationTasks.id, parseInt(id)), eq(annotationTasks.organizationId, authResult.organizationId)))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Scope to user's org
    const existing = await db.select()
      .from(annotationTasks)
      .where(and(eq(annotationTasks.id, parseInt(id)), eq(annotationTasks.organizationId, authResult.organizationId)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Annotation task not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    await db.delete(annotationTasks)
      .where(and(eq(annotationTasks.id, parseInt(id)), eq(annotationTasks.organizationId, authResult.organizationId)));

    return NextResponse.json({ message: 'Annotation task deleted successfully' });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
