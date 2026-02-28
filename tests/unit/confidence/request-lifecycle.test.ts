/**
 * Request Lifecycle Contract Tests
 *
 * Every API error response must guarantee:
 * - Structured error envelope { error: { code, message, requestId } }
 * - Correct HTTP status codes per error code
 * - x-request-id header present
 * - Consistent shape across all error helpers
 *
 * This is one test that verifies the contract for ALL error types.
 */

import { describe, expect, it } from "vitest";
import {
	type ApiErrorCode,
	type ApiErrorResponse,
	apiError,
	conflict,
	forbidden,
	internalError,
	notFound,
	quotaExceeded,
	rateLimited,
	serviceUnavailable,
	unauthorized,
	validationError,
} from "@/lib/api/errors";

// ── Error envelope shape ──

interface ErrorCase {
	name: string;
	fn: () => Response;
	expectedStatus: number;
	expectedCode: ApiErrorCode;
}

const ERROR_CASES: ErrorCase[] = [
	{
		name: "unauthorized",
		fn: () => unauthorized(),
		expectedStatus: 401,
		expectedCode: "UNAUTHORIZED",
	},
	{
		name: "forbidden",
		fn: () => forbidden(),
		expectedStatus: 403,
		expectedCode: "FORBIDDEN",
	},
	{
		name: "notFound",
		fn: () => notFound(),
		expectedStatus: 404,
		expectedCode: "NOT_FOUND",
	},
	{
		name: "validationError",
		fn: () => validationError("bad input"),
		expectedStatus: 400,
		expectedCode: "VALIDATION_ERROR",
	},
	{
		name: "rateLimited",
		fn: () => rateLimited(),
		expectedStatus: 429,
		expectedCode: "RATE_LIMITED",
	},
	{
		name: "conflict",
		fn: () => conflict("already exists"),
		expectedStatus: 409,
		expectedCode: "CONFLICT",
	},
	{
		name: "internalError",
		fn: () => internalError(),
		expectedStatus: 500,
		expectedCode: "INTERNAL_ERROR",
	},
	{
		name: "serviceUnavailable",
		fn: () => serviceUnavailable(),
		expectedStatus: 503,
		expectedCode: "SERVICE_UNAVAILABLE",
	},
	{
		name: "quotaExceeded",
		fn: () => quotaExceeded("limit reached"),
		expectedStatus: 403,
		expectedCode: "QUOTA_EXCEEDED",
	},
];

describe("Error envelope contract", () => {
	it.each(
		ERROR_CASES,
	)("$name → status $expectedStatus, code $expectedCode", async ({
		fn,
		expectedStatus,
		expectedCode,
	}) => {
		const res = fn();

		// 1. Correct HTTP status
		expect(res.status).toBe(expectedStatus);

		// 2. Structured envelope
		const body = (await (res as Response).json()) as ApiErrorResponse;
		expect(body).toHaveProperty("error");
		expect(body.error).toHaveProperty("code", expectedCode);
		expect(body.error).toHaveProperty("message");
		expect(typeof body.error.message).toBe("string");
		expect(body.error.message.length).toBeGreaterThan(0);

		// 3. Request ID present in body
		expect(body.error).toHaveProperty("requestId");
		expect(typeof body.error.requestId).toBe("string");
		expect(body.error.requestId?.length).toBeGreaterThan(0);

		// 4. x-request-id header present
		const headerRequestId = res.headers.get("x-request-id");
		expect(headerRequestId).toBeTruthy();
		expect(headerRequestId).toBe(body.error.requestId);
	});
});

// ── Status code consistency ──

describe("Status code mapping is exhaustive", () => {
	const ALL_CODES: ApiErrorCode[] = [
		"UNAUTHORIZED",
		"FORBIDDEN",
		"NOT_FOUND",
		"VALIDATION_ERROR",
		"RATE_LIMITED",
		"CONFLICT",
		"INTERNAL_ERROR",
		"SERVICE_UNAVAILABLE",
		"QUOTA_EXCEEDED",
		"NO_ORG_MEMBERSHIP",
		"SHARE_REVOKED",
		"SHARE_EXPIRED",
		"SHARE_UNAVAILABLE",
	];

	it.each(ALL_CODES)("code %s maps to a valid HTTP status", (code) => {
		const res = apiError(code, "test message");
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(res.status).toBeLessThanOrEqual(599);
	});
});

// ── Validation error details ──

describe("Validation error with details", () => {
	it("includes details in the envelope", async () => {
		const details = [{ path: "name", message: "required" }];
		const res = validationError("bad input", details);
		const body = (await (res as Response).json()) as ApiErrorResponse;
		expect(body.error.details).toEqual(details);
	});
});

// ── Custom status override ──

describe("apiError status override", () => {
	it("allows overriding the default status code", () => {
		const res = apiError("INTERNAL_ERROR", "custom", 502);
		expect(res.status).toBe(502);
	});
});
