/**
 * Structured API Error Taxonomy
 *
 * Every API route returns errors in this envelope format.
 * The SDK maps `code` to typed error classes on the client side.
 */

import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { getRequestId } from "@/lib/api/request-id";
import { logger } from "@/lib/logger";

// ── Error codes ──

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "QUOTA_EXCEEDED"
  | "NO_ORG_MEMBERSHIP";

// ── Error response shape ──

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

// ── HTTP status code mapping ──

const CODE_TO_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  QUOTA_EXCEEDED: 402,
  NO_ORG_MEMBERSHIP: 403,
};

// ── Builder ──

/**
 * Build a standardized JSON error response.
 * If `status` is omitted it is derived from `code`.
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  statusOverride?: number,
  details?: unknown,
): NextResponse<ApiErrorResponse> {
  const status = statusOverride ?? CODE_TO_STATUS[code];
  const requestId = getRequestId();

  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      requestId,
    },
  };

  logger.warn("API error response", { code, message, status, requestId });

  const res = NextResponse.json(body, { status });
  res.headers.set("x-request-id", requestId);
  return res;
}

// ── Convenience helpers ──

export function unauthorized(message = "Unauthorized") {
  return apiError("UNAUTHORIZED", message);
}

export function forbidden(message = "Forbidden") {
  return apiError("FORBIDDEN", message);
}

export function notFound(message = "Resource not found") {
  return apiError("NOT_FOUND", message);
}

export function validationError(message: string, details?: unknown) {
  return apiError("VALIDATION_ERROR", message, undefined, details);
}

export function rateLimited(message = "Too many requests. Please try again later.") {
  return apiError("RATE_LIMITED", message);
}

/** Plan entitlement / hard limits — use 403 (not 402) per trust plan. */
export function quotaExceeded(message: string, details?: unknown) {
  return apiError("QUOTA_EXCEEDED", message, 403, details);
}

export function conflict(message: string) {
  return apiError("CONFLICT", message);
}

export function internalError(message = "Internal server error") {
  return apiError("INTERNAL_ERROR", message);
}

export function serviceUnavailable(message = "Service temporarily unavailable") {
  return apiError("SERVICE_UNAVAILABLE", message);
}

// ── Zod helper ──

/**
 * Convert a ZodError into a structured VALIDATION_ERROR response.
 */
export function zodValidationError(err: ZodError) {
  return validationError("Invalid request body", err.issues);
}
