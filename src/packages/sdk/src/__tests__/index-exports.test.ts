/**
 * Source-level barrel export tests.
 *
 * These test the TypeScript source barrel (`../index`), NOT the compiled dist.
 * For compiled-output verification, see `dist-smoke.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { ValidationError as SourceValidationError } from "../errors";
import * as sdk from "../index";

describe("index.ts barrel exports — error class identity", () => {
	it("sdk.ValidationError is the real ValidationError from errors.ts", () => {
		expect(sdk.ValidationError).toBe(SourceValidationError);
	});

	it("new sdk.ValidationError().name === 'ValidationError'", () => {
		expect(new sdk.ValidationError("x").name).toBe("ValidationError");
	});

	it("sdk.ValidationError should NOT match RateLimitError via instanceof", () => {
		const rle = new sdk.RateLimitError("slow");
		expect(rle instanceof sdk.ValidationError).toBe(false);
	});

	it("SDKError backward compat should still be EvalGateError", () => {
		expect(sdk.SDKError).toBe(sdk.EvalGateError);
	});
});
