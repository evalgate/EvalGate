/**
 * Golden error catalog — ensures error codes are stable and documented.
 * - All API codes are in the canonical catalog
 * - Unknown codes degrade gracefully (no crash)
 */

import { describe, expect, it } from "vitest";
import type { ApiErrorCode } from "@/lib/api/errors";
import {
	API_ERROR_CODES,
	CANONICAL_ERROR_CODES,
	type CanonicalErrorCode,
} from "@/lib/error-catalog";
import {
	createErrorFromResponse,
	EvalGateError,
} from "@/packages/sdk/src/errors";

describe("Golden error catalog", () => {
	it("all API error codes are in canonical catalog", () => {
		const catalogSet = new Set(CANONICAL_ERROR_CODES);
		for (const code of API_ERROR_CODES) {
			expect(catalogSet.has(code as CanonicalErrorCode)).toBe(true);
		}
	});

	it("API_ERROR_CODES matches ApiErrorCode type", () => {
		const apiCodes: ApiErrorCode[] = [...API_ERROR_CODES];
		expect(apiCodes.length).toBe(API_ERROR_CODES.length);
	});

	it("unknown error code degrades gracefully — SDK creates EvalGateError with generic docs", () => {
		const err = new EvalGateError(
			"Custom message",
			"UNKNOWN_FUTURE_CODE",
			418,
			{},
		);
		expect(err).toBeInstanceOf(EvalGateError);
		expect(err.code).toBe("UNKNOWN_FUTURE_CODE");
		expect(err.documentation).toBe(
			"https://docs.ai-eval-platform.com/errors/UNKNOWN_FUTURE_CODE",
		);
		expect(err.solutions).toContain(
			"Check the error details for more information",
		);
		expect(err.retryable).toBe(false);
	});

	it("createErrorFromResponse handles unknown API code without crash", () => {
		const mockResponse = {
			status: 418,
			headers: new Headers({ "x-request-id": "req-xyz" }),
		} as Response;
		const data = {
			error: { code: "FUTURE_API_CODE", message: "Something new" },
		};
		const err = createErrorFromResponse(mockResponse, data);
		expect(err).toBeInstanceOf(EvalGateError);
		expect(err.code).toBe("FUTURE_API_CODE");
		expect(err.message).toBe("Something new");
		expect(err.statusCode).toBe(418);
	});
});
