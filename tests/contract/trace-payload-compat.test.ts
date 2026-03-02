/**
 * Contract Test: Trace Payload Compatibility Matrix
 *
 * CI acceptance criteria: runs a matrix of payload fixtures for versions
 * v-(COMPAT_WINDOW-1)..v(current) and asserts every version can be ingested.
 *
 * This test MUST pass before any breaking trace schema change ships.
 */
import { describe, expect, it } from "vitest";
import {
	COMPAT_WINDOW,
	checkCompat,
	getContractTestVersions,
} from "@/lib/reliability/compat";
import {
	TRACE_SPEC_VERSION,
	versionedSpanUploadSchema,
	versionedTraceUploadSchema,
} from "@/lib/traces/trace-schema";
import {
	validateSpanUpload,
	validateTraceUpload,
} from "@/lib/traces/trace-validator";

// ── Fixtures: minimal valid payload per version ──────────────────────────────

function minimalTracePayload(specVersion: number): Record<string, unknown> {
	return {
		specVersion,
		traceId: `trace-contract-v${specVersion}`,
		name: `Contract test trace v${specVersion}`,
		status: "success",
	};
}

function minimalSpanPayload(specVersion: number): Record<string, unknown> {
	return {
		specVersion,
		spanId: `span-contract-v${specVersion}`,
		name: "llm-call",
		type: "llm",
	};
}

// ── Version matrix ───────────────────────────────────────────────────────────

const supportedVersions = getContractTestVersions(
	TRACE_SPEC_VERSION,
	COMPAT_WINDOW,
);

describe(`Trace payload compatibility matrix (server v${TRACE_SPEC_VERSION}, window ${COMPAT_WINDOW})`, () => {
	it("supportedVersions array is non-empty", () => {
		expect(supportedVersions.length).toBeGreaterThan(0);
	});

	for (const clientVersion of supportedVersions) {
		it(`v${clientVersion} trace payload passes checkCompat`, () => {
			const result = checkCompat(
				clientVersion,
				TRACE_SPEC_VERSION,
				COMPAT_WINDOW,
			);
			expect(result.compatible).toBe(true);
		});

		it(`v${clientVersion} minimal trace payload validates against schema`, () => {
			const payload = minimalTracePayload(clientVersion);
			const result = versionedTraceUploadSchema.safeParse(payload);
			expect(result.success).toBe(true);
		});

		it(`v${clientVersion} trace payload passes validateTraceUpload`, () => {
			const payload = minimalTracePayload(clientVersion);
			const result = validateTraceUpload(payload);
			expect(result.ok).toBe(true);
		});

		it(`v${clientVersion} minimal span payload validates against schema`, () => {
			const payload = minimalSpanPayload(clientVersion);
			const result = versionedSpanUploadSchema.safeParse(payload);
			expect(result.success).toBe(true);
		});

		it(`v${clientVersion} span payload passes validateSpanUpload`, () => {
			const payload = minimalSpanPayload(clientVersion);
			const result = validateSpanUpload(payload);
			expect(result.ok).toBe(true);
		});
	}
});

describe("Payload rejection: out-of-range versions", () => {
	it("rejects version newer than server", () => {
		const payload = minimalTracePayload(TRACE_SPEC_VERSION + 1);
		const result = validateTraceUpload(payload);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.code).toBe("VERSION_TOO_NEW");
	});

	it("rejects version older than supported window", () => {
		const tooOld = Math.max(0, TRACE_SPEC_VERSION - COMPAT_WINDOW);
		if (tooOld < 1) return; // skip if window covers all versions
		const payload = minimalTracePayload(tooOld);
		const result = validateTraceUpload(payload);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.code).toBe("VERSION_TOO_OLD");
	});

	it("rejects payload missing required traceId", () => {
		const payload = { specVersion: TRACE_SPEC_VERSION, name: "test" };
		const result = validateTraceUpload(payload);
		expect(result.ok).toBe(false);
	});

	it("rejects span payload missing required spanId", () => {
		const payload = {
			specVersion: TRACE_SPEC_VERSION,
			name: "test",
			type: "llm",
		};
		const result = validateSpanUpload(payload);
		expect(result.ok).toBe(false);
	});
});

describe("Legacy payload auto-upgrade (no specVersion field)", () => {
	it("treats missing specVersion as v1 and upgrades", () => {
		const legacyPayload = {
			traceId: "legacy-trace-1",
			name: "Legacy trace",
		};
		const result = validateTraceUpload(legacyPayload);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.originalVersion).toBe(1);
			expect(result.data.specVersion).toBe(TRACE_SPEC_VERSION);
		}
	});
});
