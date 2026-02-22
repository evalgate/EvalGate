/**
 * Zod payload schemas for each job type.
 *
 * The runner validates payloads against these schemas before invoking handlers.
 * Invalid payloads are dead-lettered with JOB_PAYLOAD_INVALID.
 */

import { z } from "zod";
import type { JobType } from "./types";

const webhookDeliverySchema = z.object({
  webhookId: z.number().int().positive(),
  organizationId: z.number().int().positive(),
  event: z.string().min(1),
  data: z.unknown(),
  timestamp: z.string().min(1),
});

const PAYLOAD_SCHEMAS: Record<JobType, z.ZodSchema> = {
  webhook_delivery: webhookDeliverySchema,
};

export interface PayloadValidationResult {
  success: true;
  data: Record<string, unknown>;
}

export interface PayloadValidationError {
  success: false;
  error: string;
}

/**
 * Validate a raw job payload against the schema for its job type.
 * Returns the parsed data on success, or an error message on failure.
 */
export function validatePayload(
  type: JobType,
  payload: unknown,
): PayloadValidationResult | PayloadValidationError {
  const schema = PAYLOAD_SCHEMAS[type];
  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data as Record<string, unknown> };
  }
  return {
    success: false,
    error: result.error.issues
      .map((i: z.ZodIssue) => `${i.path.join(".")}: ${i.message}`)
      .join("; "),
  };
}
