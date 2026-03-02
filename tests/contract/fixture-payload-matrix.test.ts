/**
 * Contract Test: Fixture-file payload matrix
 *
 * Loads canonical JSON fixture files from tests/contract/fixtures/ and
 * validates that the server schema accepts every version. This ensures that
 * both the TS SDK and the Python SDK (which use the same fixture files) are
 * always in sync with the server ingestion layer.
 *
 * CI acceptance criteria: this test MUST pass before any trace schema change ships.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	validateSpanUpload,
	validateTraceUpload,
} from "@/lib/traces/trace-validator";

// ── Fixture loader ────────────────────────────────────────────────────────────

function loadFixture(name: string): Record<string, unknown> {
	const p = resolve(__dirname, "fixtures", name);
	const raw = readFileSync(p, "utf8");
	const parsed = JSON.parse(raw) as Record<string, unknown>;
	// Strip internal documentation fields
	const { _comment: _, _schemaVersion: __, ...payload } = parsed;
	return payload;
}

// ── Trace fixtures ────────────────────────────────────────────────────────────

describe("Fixture file: trace_v1.json", () => {
	const fixture = loadFixture("trace_v1.json");

	it("fixture specVersion is 1", () => {
		expect(fixture.specVersion).toBe(1);
	});

	it("validates against versionedTraceUploadSchema", () => {
		const result = validateTraceUpload(fixture);
		expect(result.ok).toBe(true);
	});

	it("has required fields: traceId, name", () => {
		expect(typeof fixture.traceId).toBe("string");
		expect(typeof fixture.name).toBe("string");
	});

	it("environment block is present and well-formed", () => {
		const env = fixture.environment as Record<string, unknown>;
		expect(env).toBeDefined();
		expect(typeof env.sdkName).toBe("string");
		expect(typeof env.sdkVersion).toBe("string");
	});

	it("serializes and re-parses without data loss", () => {
		const roundtripped = JSON.parse(JSON.stringify(fixture)) as Record<
			string,
			unknown
		>;
		expect(roundtripped.traceId).toBe(fixture.traceId);
		expect(roundtripped.specVersion).toBe(fixture.specVersion);
	});
});

// ── Span fixtures ─────────────────────────────────────────────────────────────

describe("Fixture file: span_v1.json", () => {
	const fixture = loadFixture("span_v1.json");

	it("fixture specVersion is 1", () => {
		expect(fixture.specVersion).toBe(1);
	});

	it("validates against versionedSpanUploadSchema", () => {
		const result = validateSpanUpload(fixture);
		expect(result.ok).toBe(true);
	});

	it("has required fields: spanId, name, type", () => {
		expect(typeof fixture.spanId).toBe("string");
		expect(typeof fixture.name).toBe("string");
		expect(typeof fixture.type).toBe("string");
	});

	it("behavioral block has messages, toolCalls, reasoningSegments, retrievedDocuments", () => {
		const b = fixture.behavioral as Record<string, unknown[]>;
		expect(Array.isArray(b.messages)).toBe(true);
		expect(Array.isArray(b.toolCalls)).toBe(true);
		expect(Array.isArray(b.reasoningSegments)).toBe(true);
		expect(Array.isArray(b.retrievedDocuments)).toBe(true);
	});

	it("messages contain system, user, assistant roles", () => {
		const b = fixture.behavioral as Record<string, Array<{ role: string }>>;
		const roles = b.messages.map((m) => m.role);
		expect(roles).toContain("system");
		expect(roles).toContain("user");
		expect(roles).toContain("assistant");
	});

	it("toolCalls have name, arguments, success", () => {
		const b = fixture.behavioral as Record<
			string,
			Array<Record<string, unknown>>
		>;
		const tc = b.toolCalls[0]!;
		expect(typeof tc.name).toBe("string");
		expect(typeof tc.arguments).toBe("object");
		expect(typeof tc.success).toBe("boolean");
	});

	it("serializes and re-parses without data loss", () => {
		const roundtripped = JSON.parse(JSON.stringify(fixture)) as Record<
			string,
			unknown
		>;
		expect(roundtripped.spanId).toBe(fixture.spanId);
	});
});

// ── Cross-fixture consistency ─────────────────────────────────────────────────

describe("Cross-fixture consistency", () => {
	it("all fixtures use the same specVersion", () => {
		const trace = loadFixture("trace_v1.json");
		const span = loadFixture("span_v1.json");
		expect(trace.specVersion).toBe(span.specVersion);
	});

	it("trace fixture is accepted by server (full validation path)", () => {
		const trace = loadFixture("trace_v1.json");
		const r = validateTraceUpload(trace);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.data.traceId).toBe("fixture-trace-v1-001");
	});

	it("span fixture is accepted by server (full validation path)", () => {
		const span = loadFixture("span_v1.json");
		const r = validateSpanUpload(span);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.data.spanId).toBe("fixture-span-v1-001");
	});
});
