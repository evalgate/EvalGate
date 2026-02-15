import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { webhooks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const webhook = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, parseInt(id)))
      .limit(1);

    if (webhook.length === 0) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    const { secret, ...webhookWithoutSecret } = webhook[0];

    return NextResponse.json(webhookWithoutSecret, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { url, events, status } = body;

    const existingWebhook = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, parseInt(id)))
      .limit(1);

    if (existingWebhook.length === 0) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    if (url !== undefined) {
      if (typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        return NextResponse.json(
          { error: 'URL must start with http:// or https://', code: 'INVALID_URL' },
          { status: 400 }
        );
      }
    }

    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return NextResponse.json(
          { error: 'Events array cannot be empty', code: 'INVALID_EVENTS' },
          { status: 400 }
        );
      }
    }

    if (status !== undefined) {
      if (status !== 'active' && status !== 'inactive') {
        return NextResponse.json(
          { error: 'Status must be "active" or "inactive"', code: 'INVALID_STATUS' },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString()
    };

    if (url !== undefined) {
      updates.url = url;
    }

    if (events !== undefined) {
      updates.events = JSON.stringify(events);
    }

    if (status !== undefined) {
      updates.status = status;
    }

    const updated = await db
      .update(webhooks)
      .set(updates)
      .where(eq(webhooks.id, parseInt(id)))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    const { secret, ...webhookWithoutSecret } = updated[0];

    return NextResponse.json(webhookWithoutSecret, { status: 200 });
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
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const existingWebhook = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, parseInt(id)))
      .limit(1);

    if (existingWebhook.length === 0) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    const deleted = await db
      .delete(webhooks)
      .where(eq(webhooks.id, parseInt(id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    const { secret: _secret, ...deletedWithoutSecret } = deleted[0];
    return NextResponse.json(
      { 
        message: 'Webhook deleted successfully',
        deletedWebhook: deletedWithoutSecret
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