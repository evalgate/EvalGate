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
	| "NO_ORG_MEMBERSHIP"
	| "SHARE_REVOKED"
	| "SHARE_EXPIRED"
	| "SHARE_UNAVAILABLE";

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
	SHARE_REVOKED: 410,
	SHARE_EXPIRED: 410,
	SHARE_UNAVAILABLE: 410,
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
): NextResponse {
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

/** Return a 401 Unauthorized error response. */
export function unauthorized(message = "Unauthorized") {
	return apiError("UNAUTHORIZED", message);
}

/** Return a 403 Forbidden error response. */
export function forbidden(message = "Forbidden") {
	return apiError("FORBIDDEN", message);
}

/** Return a 404 Not Found error response. */
export function notFound(message = "Resource not found") {
	return apiError("NOT_FOUND", message);
}

/** Return a 400 Validation Error response with optional structured details. */
export function validationError(message: string, details?: unknown) {
	return apiError("VALIDATION_ERROR", message, undefined, details);
}

/** Return a 429 Rate Limited error response. */
export function rateLimited(
	message = "Too many requests. Please try again later.",
) {
	return apiError("RATE_LIMITED", message);
}

/** Plan entitlement / hard limits — use 403 (not 402) per trust plan. */
export function quotaExceeded(message: string, details?: unknown) {
	return apiError("QUOTA_EXCEEDED", message, 403, details);
}

/** Return a 409 Conflict error response. */
export function conflict(message: string) {
	return apiError("CONFLICT", message);
}

/** Return a 500 Internal Server Error response. */
export function internalError(message = "Internal server error") {
	return apiError("INTERNAL_ERROR", message);
}

/** Return a 503 Service Unavailable error response. */
export function serviceUnavailable(
	message = "Service temporarily unavailable",
) {
	return apiError("SERVICE_UNAVAILABLE", message);
}

// ── Database error classification ──

/**
 * Map well-known Postgres / connection errors to structured API responses.
 * Returns `null` for unrecognised errors so the caller can fall back to a generic 500.
 */
export function classifyDatabaseError(error: unknown): NextResponse | null {
	const pgCode = (error as Record<string, unknown>)?.code;

	if (pgCode === "23505") {
		return NextResponse.json(
			{ error: { code: "CONFLICT", message: "Resource already exists" } },
			{ status: 409 },
		);
	}
	if (pgCode === "23503") {
		return NextResponse.json(
			{
				error: {
					code: "REFERENCE_ERROR",
					message: "Referenced resource not found",
				},
			},
			{ status: 409 },
		);
	}

	const msg = String((error as Record<string, unknown>)?.message || "");
	if (
		msg.includes("connection") ||
		msg.includes("ECONNREFUSED") ||
		msg.includes("ENOTFOUND")
	) {
		return NextResponse.json(
			{
				error: {
					code: "SERVICE_UNAVAILABLE",
					message: "Service temporarily unavailable",
				},
			},
			{ status: 503 },
		);
	}

	return null;
}

// ── Zod helper ──

/**
 * Convert a ZodError into a structured VALIDATION_ERROR response.
 */
export function zodValidationError(err: ZodError) {
	return validationError("Invalid request body", err.issues);
}
