import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { webhookDeliveries, webhooks } from "@/db/schema";
import { logger } from "@/lib/logger";
import { decryptWebhookSecret } from "@/lib/security/webhook-secrets";

export interface WebhookDeliveryPayload {
  webhookId: number;
  organizationId: number;
  event: string;
  data: unknown;
  timestamp: string;
}

/**
 * Job handler for async webhook delivery.
 *
 * Extracted from WebhookService.deliver() — performs the HTTP fetch,
 * records the delivery attempt with durationMs, and updates lastDeliveredAt
 * on success. Throws on failure so the runner can apply retry/backoff.
 */
export async function handleWebhookDelivery(payload: Record<string, unknown>): Promise<void> {
  const { webhookId, organizationId, event, data, timestamp } =
    payload as unknown as WebhookDeliveryPayload;

  const webhookRows = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.organizationId, organizationId)))
    .limit(1);

  const webhook = webhookRows[0];
  if (!webhook) {
    throw new Error(`Webhook ${webhookId} not found`);
  }
  if (webhook.status !== "active") {
    logger.warn("Webhook is not active — skipping delivery", { webhookId, status: webhook.status });
    return; // Not an error; don't retry
  }

  const webhookPayload = { event, data, timestamp, organizationId };
  const payloadString = JSON.stringify(webhookPayload);

  const secret = decryptWebhookSecret(organizationId, {
    encryptedSecret: webhook.encryptedSecret,
    secretIv: webhook.secretIv,
    secretTag: webhook.secretTag,
    secret: webhook.secret,
  });
  if (!secret) {
    throw new Error(`Webhook ${webhookId} secret not available`);
  }

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payloadString);
  const signature = `sha256=${hmac.digest("hex")}`;

  const startTime = Date.now();
  let deliveryStatus: "success" | "failed" = "failed";
  let responseCode: number | null = null;
  let responseBody = "";
  let errorMsg: string | null = null;

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": event,
        "X-Webhook-Timestamp": timestamp,
        "User-Agent": "EvalAI-Webhooks/1.0",
      },
      body: payloadString,
      signal: AbortSignal.timeout(10000),
    });

    responseCode = response.status;
    responseBody = await response.text();

    if (response.ok) {
      deliveryStatus = "success";
    } else {
      errorMsg = `HTTP ${responseCode}: ${responseBody.substring(0, 500)}`;
    }
  } catch (err: any) {
    errorMsg = err.message;
  }

  const durationMs = Date.now() - startTime;

  // Record delivery attempt
  await db.insert(webhookDeliveries).values({
    webhookId,
    eventType: event,
    payload: webhookPayload as any,
    status: deliveryStatus,
    responseStatus: responseCode,
    responseBody: errorMsg ? `Error: ${errorMsg}` : responseBody,
    attemptCount: 1,
    createdAt: new Date().toISOString(),
  });

  // Update lastDeliveredAt on success
  if (deliveryStatus === "success") {
    await db
      .update(webhooks)
      .set({ lastDeliveredAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(webhooks.id, webhookId));

    logger.info("Webhook delivered successfully", { webhookId, durationMs, responseCode });
  } else {
    logger.warn("Webhook delivery failed", {
      webhookId,
      durationMs,
      responseCode,
      error: errorMsg,
    });
    // Throw so the runner applies retry/backoff
    throw new Error(errorMsg ?? "Webhook delivery failed");
  }
}
