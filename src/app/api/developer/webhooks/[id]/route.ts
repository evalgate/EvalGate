import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { webhooks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { notFound, forbidden, validationError } from '@/lib/api/errors';

type LoadWebhookResult =
  | { error: NextResponse }
  | { webhook: typeof webhooks.$inferSelect };

/**
 * Fetch the webhook and verify it belongs to the caller's org.
 * Returns the webhook row or a NextResponse error.
 */
async function loadOwnedWebhook(webhookId: number, ctx: AuthContext): Promise<LoadWebhookResult> {
  const result = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, webhookId))
    .limit(1);

  if (result.length === 0) {
    return { error: notFound('Webhook not found') };
  }
  if (result[0].organizationId !== ctx.organizationId) {
    return { error: forbidden('Webhook does not belong to your organization') };
  }
  return { webhook: result[0] };
}

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const webhookId = parseInt(params.id);
  if (isNaN(webhookId)) {
    return validationError('Valid ID is required');
  }

  const result = await loadOwnedWebhook(webhookId, ctx);
  if ('error' in result) return result.error;

  const { secret, ...webhookWithoutSecret } = result.webhook;
  return NextResponse.json(webhookWithoutSecret, { status: 200 });
})

export const PATCH = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const webhookId = parseInt(params.id);
  if (isNaN(webhookId)) {
    return validationError('Valid ID is required');
  }

  const result = await loadOwnedWebhook(webhookId, ctx);
  if ('error' in result) return result.error;

  const body = await req.json();
  const { url, events, status } = body;

  if (url !== undefined) {
    if (typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return validationError('URL must start with http:// or https://');
    }
  }

  if (events !== undefined) {
    if (!Array.isArray(events) || events.length === 0) {
      return validationError('Events array cannot be empty');
    }
  }

  if (status !== undefined) {
    if (status !== 'active' && status !== 'inactive') {
      return validationError('Status must be "active" or "inactive"');
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
    .where(eq(webhooks.id, webhookId))
    .returning();

  if (updated.length === 0) {
    return notFound('Webhook not found');
  }

  const { secret, ...webhookWithoutSecret } = updated[0];
  return NextResponse.json(webhookWithoutSecret, { status: 200 });
})

export const DELETE = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const webhookId = parseInt(params.id);
  if (isNaN(webhookId)) {
    return validationError('Valid ID is required');
  }

  const result = await loadOwnedWebhook(webhookId, ctx);
  if ('error' in result) return result.error;

  const deleted = await db
    .delete(webhooks)
    .where(eq(webhooks.id, webhookId))
    .returning();

  if (deleted.length === 0) {
    return notFound('Webhook not found');
  }

  const { secret: _secret, ...deletedWithoutSecret } = deleted[0];
  return NextResponse.json(
    {
      message: 'Webhook deleted successfully',
      deletedWebhook: deletedWithoutSecret
    },
    { status: 200 }
  );
})
