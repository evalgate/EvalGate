import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookDeliveries, webhooks } from "@/db/schema";
import { forbidden, notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const webhookId = parseInt(params.id, 10);

  if (Number.isNaN(webhookId)) {
    return validationError("Valid webhook ID is required");
  }

  // Verify the parent webhook exists and belongs to this org
  const webhook = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).limit(1);

  if (webhook.length === 0) {
    return notFound("Webhook not found");
  }
  if (webhook[0].organizationId !== ctx.organizationId) {
    return forbidden("Webhook does not belong to your organization");
  }

  // Extract query parameters
  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  if (status && !["success", "failed", "pending"].includes(status)) {
    return validationError("Invalid status. Must be one of: success, failed, pending");
  }

  // Build query conditions
  let whereConditions = eq(webhookDeliveries.webhookId, webhookId);

  if (status) {
    whereConditions = and(
      whereConditions,
      eq(webhookDeliveries.status, status),
    ) as typeof whereConditions;
  }

  // Fetch deliveries with pagination
  const deliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(whereConditions)
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count for the same conditions
  const totalCountResult = await db.select().from(webhookDeliveries).where(whereConditions);

  return NextResponse.json(
    {
      deliveries: deliveries.map((delivery) => ({
        id: delivery.id,
        webhookId: delivery.webhookId,
        eventType: delivery.eventType,
        payload: delivery.payload,
        status: delivery.status,
        responseStatus: delivery.responseStatus,
        responseBody: delivery.responseBody,
        attemptCount: delivery.attemptCount,
        createdAt: delivery.createdAt,
      })),
      total: totalCountResult.length,
    },
    { status: 200 },
  );
});
