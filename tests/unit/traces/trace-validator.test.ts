import { describe, expect, it } from "vitest";
import {
	TRACE_MIN_SUPPORTED_VERSION,
	TRACE_SPEC_VERSION,
} from "@/lib/traces/trace-schema";
import {
	isVersionCompatible,
	validateSpanUpload,
	validateTraceUpload,
} from "@/lib/traces/trace-validator";

const validTrace = {
	specVersion: TRACE_SPEC_VERSION,
	traceId: "trace-abc-123",
	name: "test trace",
};

const validSpan = {
	specVersion: TRACE_SPEC_VERSION,
	spanId: "span-abc-123",
	name: "llm-call",
	type: "llm",
};

describe("validateTraceUpload", () => {
	it("accepts a valid current-version payload", () => {
		const result = validateTraceUpload(validTrace);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.upgraded).toBe(false);
			expect(result.originalVersion).toBe(TRACE_SPEC_VERSION);
		}
	});

	it("auto-upgrades missing specVersion (legacy payload)", () => {
		const legacy = { traceId: "trace-abc", name: "legacy" };
		const result = validateTraceUpload(legacy);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.originalVersion).toBe(1);
		}
	});

	it("rejects version newer than server", () => {
		const payload = { ...validTrace, specVersion: TRACE_SPEC_VERSION + 1 };
		const result = validateTraceUpload(payload);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.code).toBe("VERSION_TOO_NEW");
	});

	it("rejects payload missing required traceId", () => {
		const payload = { specVersion: TRACE_SPEC_VERSION, name: "no-id" };
		const result = validateTraceUpload(payload);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.code).toBe("VALIDATION_ERROR");
	});

	it("rejects payload missing required name", () => {
		const payload = { specVersion: TRACE_SPEC_VERSION, traceId: "t-1" };
		const result = validateTraceUpload(payload);
		expect(result.ok).toBe(false);
	});

	it("rejects null input", () => {
		const result = validateTraceUpload(null);
		expect(result.ok).toBe(false);
	});

	it("accepts optional fields", () => {
		const payload = {
			...validTrace,
			status: "success",
			durationMs: 1234,
			metadata: { foo: "bar" },
			environment: { deployEnvironment: "prod", sdkVersion: "1.0.0" },
		};
		const result = validateTraceUpload(payload);
		expect(result.ok).toBe(true);
	});
});

describe("validateSpanUpload", () => {
	it("accepts a valid current-version span", () => {
		const result = validateSpanUpload(validSpan);
		expect(result.ok).toBe(true);
	});

	it("accepts span without specVersion (inherits server version)", () => {
		const { specVersion: _, ...noVersion } = validSpan;
		const result = validateSpanUpload(noVersion);
		expect(result.ok).toBe(true);
	});

	it("rejects span missing required spanId", () => {
		const payload = { specVersion: TRACE_SPEC_VERSION, name: "x", type: "llm" };
		const result = validateSpanUpload(payload);
		expect(result.ok).toBe(false);
	});

	it("accepts behavioral payload", () => {
		const payload = {
			...validSpan,
			behavioral: {
				messages: [{ role: "user", content: "hello" }],
				toolCalls: [{ name: "search", arguments: { q: "test" } }],
			},
		};
		const result = validateSpanUpload(payload);
		expect(result.ok).toBe(true);
	});
});

describe("isVersionCompatible", () => {
	it("accepts current version", () => {
		expect(isVersionCompatible(TRACE_SPEC_VERSION)).toBe(true);
	});

	it("accepts min supported version", () => {
		expect(isVersionCompatible(TRACE_MIN_SUPPORTED_VERSION)).toBe(true);
	});

	it("rejects version above max", () => {
		expect(isVersionCompatible(TRACE_SPEC_VERSION + 1)).toBe(false);
	});

	it("rejects version below min", () => {
		if (TRACE_MIN_SUPPORTED_VERSION > 1) {
			expect(isVersionCompatible(TRACE_MIN_SUPPORTED_VERSION - 1)).toBe(false);
		}
	});
});
