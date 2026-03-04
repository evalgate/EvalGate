/**
 * Tests for OpenTelemetry exporter
 */

import { describe, expect, it } from "vitest";
import { createOTelExporter, OTelExporter } from "../src/otel";

describe("OTelExporter", () => {
	it("should create exporter with defaults", () => {
		const exporter = new OTelExporter();
		expect(exporter).toBeDefined();
	});

	it("should create exporter with custom options", () => {
		const exporter = new OTelExporter({
			endpoint: "http://custom:4318/v1/traces",
			serviceName: "my-app",
			sdkVersion: "1.0.0",
		});
		expect(exporter).toBeDefined();
	});

	it("should export run result as OTEL payload", () => {
		const exporter = new OTelExporter({ serviceName: "test-service" });

		const payload = exporter.exportRunResult({
			runId: "run-test-123",
			metadata: {
				startedAt: 1000,
				completedAt: 2000,
				duration: 1000,
				mode: "spec",
			},
			results: [
				{
					specId: "spec1",
					name: "test-spec",
					filePath: "eval/test.ts",
					result: { status: "passed", score: 0.95, duration: 100 },
				},
				{
					specId: "spec2",
					name: "test-spec-2",
					filePath: "eval/test.ts",
					result: { status: "failed", duration: 200, error: "oops" },
				},
			],
			summary: { passed: 1, failed: 1, passRate: 0.5 },
		});

		expect(payload.resourceSpans).toHaveLength(1);
		const scopeSpans = payload.resourceSpans[0].scopeSpans;
		expect(scopeSpans).toHaveLength(1);

		// Root span + 2 spec spans
		const spans = scopeSpans[0].spans;
		expect(spans).toHaveLength(3);

		// Root span
		expect(spans[0].name).toContain("evalgate.run");
		expect(spans[0].status.code).toBe(2); // ERROR

		// Spec spans
		expect(spans[1].parentSpanId).toBe(spans[0].spanId);
		expect(spans[1].status.code).toBe(1); // OK
		expect(spans[2].status.code).toBe(2); // ERROR
	});

	it("should include resource attributes", () => {
		const exporter = new OTelExporter({
			serviceName: "my-service",
			resourceAttributes: { "deployment.environment": "test" },
		});

		const payload = exporter.exportRunResult({
			runId: "run-1",
			metadata: {
				startedAt: 1000,
				completedAt: 2000,
				duration: 1000,
				mode: "spec",
			},
			results: [],
			summary: { passed: 0, failed: 0, passRate: 0 },
		});

		const attrs = payload.resourceSpans[0].resource.attributes;
		const serviceNameAttr = attrs.find((a) => a.key === "service.name");
		expect(serviceNameAttr?.value.stringValue).toBe("my-service");

		const envAttr = attrs.find((a) => a.key === "deployment.environment");
		expect(envAttr?.value.stringValue).toBe("test");
	});

	it("should set span IDs correctly", () => {
		const exporter = new OTelExporter();

		const payload = exporter.exportRunResult({
			runId: "run-1",
			metadata: {
				startedAt: 1000,
				completedAt: 2000,
				duration: 1000,
				mode: "spec",
			},
			results: [
				{
					specId: "s1",
					name: "spec",
					filePath: "f.ts",
					result: { status: "passed", duration: 50 },
				},
			],
			summary: { passed: 1, failed: 0, passRate: 1 },
		});

		const spans = payload.resourceSpans[0].scopeSpans[0].spans;
		const root = spans[0];
		const child = spans[1];

		// Trace IDs should match
		expect(child.traceId).toBe(root.traceId);
		// Child should reference root
		expect(child.parentSpanId).toBe(root.spanId);
		// IDs should be valid hex
		expect(root.traceId).toMatch(/^[0-9a-f]{32}$/);
		expect(root.spanId).toMatch(/^[0-9a-f]{16}$/);
	});

	it("should include spec attributes", () => {
		const exporter = new OTelExporter();

		const payload = exporter.exportRunResult({
			runId: "run-1",
			metadata: {
				startedAt: 1000,
				completedAt: 2000,
				duration: 1000,
				mode: "spec",
			},
			results: [
				{
					specId: "spec-abc",
					name: "my-test",
					filePath: "eval/test.ts",
					result: { status: "passed", score: 0.85, duration: 42 },
				},
			],
			summary: { passed: 1, failed: 0, passRate: 1 },
		});

		const specSpan = payload.resourceSpans[0].scopeSpans[0].spans[1];
		const getAttr = (key: string) =>
			specSpan.attributes.find((a) => a.key === key);

		expect(getAttr("evalgate.spec.id")?.value.stringValue).toBe("spec-abc");
		expect(getAttr("evalgate.spec.name")?.value.stringValue).toBe("my-test");
		expect(getAttr("evalgate.spec.status")?.value.stringValue).toBe("passed");
		expect(getAttr("evalgate.spec.score")?.value.doubleValue).toBe(0.85);
		expect(getAttr("evalgate.spec.duration_ms")?.value.intValue).toBe("42");
	});
});

describe("createOTelExporter", () => {
	it("should be a convenience factory", () => {
		const exporter = createOTelExporter({ serviceName: "test" });
		expect(exporter).toBeInstanceOf(OTelExporter);
	});
});
