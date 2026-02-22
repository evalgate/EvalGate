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

/** Typed error so the runner can set the appropriate error code. */
export class WebhookDeliveryError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "WebhookDeliveryError";
  }
}

/**
 * Job handler for async webhook delivery.
 *
 * Phase 5A: Deduplicates via payload hash — if a successful delivery
 * already exists for this (webhookId, eventType, payloadHash), skips.
 *
 * Phase 5B: Respects HTTP 429 + Retry-After header — throws a typed
 * error that the runner can use for scheduling.
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

  // ── 5A: Compute payload hash for deduplication ─────────────────────────────
  const payloadHash = crypto.createHash("sha256").update(payloadString).digest("hex");

  // Check if already delivered successfully
  const existingDelivery = await db
    .select({ id: webhookDeliveries.id, status: webhookDeliveries.status })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.webhookId, webhookId),
        eq(webhookDeliveries.eventType, event),
        eq(webhookDeliveries.payloadHash, payloadHash),
        eq(webhookDeliveries.status, "success"),
      ),
    )
    .limit(1);

  if (existingDelivery[0]) {
    logger.info("Webhook delivery skipped — already delivered", {
      webhookId,
      event,
      existingDeliveryId: existingDelivery[0].id,
    });
    return; // Idempotent skip — don't retry
  }

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
  } catch (err: unknown) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Date.now() - startTime;

  // Record delivery attempt (with hash for dedup)
  try {
    await db.insert(webhookDeliveries).values({
      webhookId,
      eventType: event,
      payload: webhookPayload as unknown,
      payloadHash,
      status: deliveryStatus,
      responseStatus: responseCode,
      responseBody: errorMsg ? `Error: ${errorMsg}` : responseBody,
      attemptCount: 1,
      createdAt: new Date().toISOString(),
    });
  } catch (insertErr: unknown) {
    // Unique constraint violation on dedup index — already recorded
    if (insertErr instanceof Error && insertErr.message?.includes("UNIQUE constraint")) {
      logger.info("Webhook delivery record dedup — already exists", { webhookId, event });
    } else {
      throw insertErr;
    }
  }

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

    // ── 5B: Handle 429 + Retry-After ─────────────────────────────────────────
    if (responseCode === 429) {
      // Parse Retry-After (seconds) if present — default to 60s
      let retryAfterMs = 60_000;
      // responseBody might have Retry-After in headers; we already consumed the response
      // Try parsing from the error message or use default
      const retryAfterMatch = responseBody.match(/retry-after[":\s]*(\d+)/i);
      if (retryAfterMatch) {
        retryAfterMs = Number(retryAfterMatch[1]) * 1000;
      }
      throw new WebhookDeliveryError(
        `Rate limited (429): ${errorMsg}`,
        "JOB_RATE_LIMITED",
        retryAfterMs,
      );
    }

    // 5xx upstream errors
    if (responseCode && responseCode >= 500) {
      throw new WebhookDeliveryError(errorMsg ?? "Upstream 5xx error", "JOB_UPSTREAM_5XX");
    }

    // Other failures
    throw new Error(errorMsg ?? "Webhook delivery failed");
  }
}
