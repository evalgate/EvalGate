import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, organizationMembers, evaluations, workflows, traces, annotationTasks, webhooks } from '@/db/schema';
import { eq, like, desc, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { sanitizeSearchInput } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // Single organization by ID
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const organization = await db.select()
        .from(organizations)
        .where(eq(organizations.id, parseInt(id)))
        .limit(1);

      if (organization.length === 0) {
        return NextResponse.json({ 
          error: 'Organization not found',
          code: 'NOT_FOUND' 
        }, { status: 404 });
      }

      return NextResponse.json(organization[0], { status: 200 });
    }

    // List organizations with pagination and search
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');

    // Build and execute the query with search condition
    const results = await db.select()
      .from(organizations)
      .where(search ? like(organizations.name, `%${sanitizeSearchInput(search)}%`) : undefined)
      .orderBy(desc(organizations.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
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

    const { name } = body;

    // Validate required fields
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ 
        error: "Name is required and must be a string",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    // Sanitize input
    const sanitizedName = name.trim();

    if (sanitizedName.length === 0) {
      return NextResponse.json({ 
        error: "Name cannot be empty",
        code: "INVALID_NAME" 
      }, { status: 400 });
    }

    // Create organization
    const now = new Date().toISOString();
    const newOrganization = await db.insert(organizations)
      .values({
        name: sanitizedName,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Add the creator as an owner member of the new organization
    if (newOrganization.length > 0) {
      await db.insert(organizationMembers).values({
        organizationId: newOrganization[0].id,
        userId: user.id,
        role: 'owner',
        createdAt: now,
      });
    }

    return NextResponse.json(newOrganization[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
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

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const body = await request.json();

    // Security check: reject if userId provided in body
    if ('userId' in body || 'user_id' in body) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    const { name } = body;

    // Validate name if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json({ 
        error: "Name must be a non-empty string",
        code: "INVALID_NAME" 
      }, { status: 400 });
    }

    // Check if organization exists
    const existing = await db.select()
      .from(organizations)
      .where(eq(organizations.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Organization not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    // Prepare update data
    const updateData: {
      name?: string;
      updatedAt: string;
    } = {
      updatedAt: new Date().toISOString()
    };

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    // Update organization
    const updated = await db.update(organizations)
      .set(updateData)
      .where(eq(organizations.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0], { status: 200 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
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

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if organization exists
    const existing = await db.select()
      .from(organizations)
      .where(eq(organizations.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Organization not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    const orgId = parseInt(id);

    // Cascade delete: remove all org-scoped data before deleting the org
    await db.delete(webhooks).where(eq(webhooks.organizationId, orgId));
    await db.delete(annotationTasks).where(eq(annotationTasks.organizationId, orgId));
    await db.delete(traces).where(eq(traces.organizationId, orgId));
    await db.delete(workflows).where(eq(workflows.organizationId, orgId));
    await db.delete(evaluations).where(eq(evaluations.organizationId, orgId));
    await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgId));

    // Delete the organization itself
    const deleted = await db.delete(organizations)
      .where(eq(organizations.id, orgId))
      .returning();

    return NextResponse.json({
      message: 'Organization deleted successfully',
    }, { status: 200 });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}