import { describe, expect, it } from "vitest";
import { validatePayload } from "@/lib/jobs/payload-schemas";
import type { JobType } from "@/lib/jobs/types";

// Mock JobType since it's imported
type MockJobType = "webhook_delivery";

describe("validatePayload", () => {
	// Happy path tests
	it("should validate correct webhook_delivery payload", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 123,
			organizationId: 456,
			event: "push",
			data: { repository: "test" },
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(payload);
		}
	});

	it("should accept webhook delivery with minimal valid data", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 1,
			organizationId: 1,
			event: "a",
			data: null,
			timestamp: "t",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.webhookId).toBe(1);
			expect(result.data.organizationId).toBe(1);
		}
	});

	it("should accept webhook delivery with complex data", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 999,
			organizationId: 888,
			event: "deployment",
			data: {
				commits: [{ id: "abc", message: "test" }],
				user: { name: "John", email: "john@example.com" },
				metadata: { version: "1.0.0", environment: "prod" },
			},
			timestamp: "2023-12-31T23:59:59.999Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.data).toEqual(payload.data);
		}
	});

	// Edge case tests
	it("should accept positive integers at boundaries", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: Number.MAX_SAFE_INTEGER,
			organizationId: 1,
			event: "test",
			data: {},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(true);
	});

	it("should accept very long strings", () => {
		const type: MockJobType = "webhook_delivery";
		const longString = "a".repeat(10000);
		const payload = {
			webhookId: 1,
			organizationId: 1,
			event: longString,
			data: {},
			timestamp: longString,
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(true);
	});

	it("should accept arrays and objects in data field", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 1,
			organizationId: 1,
			event: "test",
			data: {
				array: [1, 2, 3, "string", { nested: true }],
				object: { key: "value", number: 123, boolean: true },
				nullValue: null,
				undefinedValue: undefined,
			},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(true);
	});

	// Error/invalid input tests
	it("should reject payload with missing webhookId", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			organizationId: 456,
			event: "push",
			data: {},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain("webhookId: Required");
		}
	});

	it("should reject payload with missing organizationId", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 123,
			event: "push",
			data: {},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain("organizationId: Required");
		}
	});

	it("should reject payload with missing event", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 123,
			organizationId: 456,
			data: {},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain("event: Required");
		}
	});

	it("should reject payload with missing timestamp", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 123,
			organizationId: 456,
			event: "push",
			data: {},
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain("timestamp: Required");
		}
	});

	it("should reject negative webhookId", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: -1,
			organizationId: 456,
			event: "push",
			data: {},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain(
				"webhookId: Number must be greater than 0",
			);
		}
	});

	it("should reject zero webhookId", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 0,
			organizationId: 456,
			event: "push",
			data: {},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain(
				"webhookId: Number must be greater than 0",
			);
		}
	});

	it("should reject negative organizationId", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 123,
			organizationId: -1,
			event: "push",
			data: {},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain(
				"organizationId: Number must be greater than 0",
			);
		}
	});

	it("should reject zero organizationId", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 123,
			organizationId: 0,
			event: "push",
			data: {},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain(
				"organizationId: Number must be greater than 0",
			);
		}
	});

	it("should reject empty event string", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 123,
			organizationId: 456,
			event: "",
			data: {},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain(
				"event: String must contain at least 1 character(s)",
			);
		}
	});

	it("should reject empty timestamp string", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 123,
			organizationId: 456,
			event: "push",
			data: {},
			timestamp: "",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain(
				"timestamp: String must contain at least 1 character(s)",
			);
		}
	});

	it("should reject non-integer webhookId", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 123.45,
			organizationId: 456,
			event: "push",
			data: {},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain(
				"webhookId: Expected integer, received float",
			);
		}
	});

	it("should reject non-integer organizationId", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 123,
			organizationId: 456.78,
			event: "push",
			data: {},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain(
				"organizationId: Expected integer, received float",
			);
		}
	});

	it("should reject string webhookId", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: "123",
			organizationId: 456,
			event: "push",
			data: {},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain(
				"webhookId: Expected number, received string",
			);
		}
	});

	it("should reject multiple validation errors", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: -1,
			organizationId: 0,
			event: "",
			data: {},
			timestamp: "",
		};

		const result = validatePayload(type as JobType, payload);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain(
				"webhookId: Number must be greater than 0",
			);
			expect(result.error).toContain(
				"organizationId: Number must be greater than 0",
			);
			expect(result.error).toContain(
				"event: String must contain at least 1 character(s)",
			);
			expect(result.error).toContain(
				"timestamp: String must contain at least 1 character(s)",
			);
			expect(result.error).toContain("; "); // Multiple errors separated by semicolon
		}
	});

	// Type safety tests
	it("should return proper success type structure", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {
			webhookId: 1,
			organizationId: 1,
			event: "test",
			data: {},
			timestamp: "2023-01-01T00:00:00Z",
		};

		const result = validatePayload(type as JobType, payload);
		if (result.success) {
			expect(typeof result.data).toBe("object");
			expect(result.data).not.toBeNull();
		}
	});

	it("should return proper error type structure", () => {
		const type: MockJobType = "webhook_delivery";
		const payload = {}; // Invalid payload

		const result = validatePayload(type as JobType, payload);
		if (!result.success) {
			expect(typeof result.error).toBe("string");
			expect(result.error.length).toBeGreaterThan(0);
		}
	});

	// Edge case data types
	it("should accept all data types in data field", () => {
		const type: MockJobType = "webhook_delivery";
		const testCases = [
			{ data: null },
			{ data: undefined },
			{ data: "string" },
			{ data: 123 },
			{ data: true },
			{ data: false },
			{ data: [] },
			{ data: {} },
			{ data: [1, "string", { nested: true }] },
			{ data: { key: "value", nested: { deep: true } } },
		];

		testCases.forEach((testCase, _index) => {
			const payload = {
				webhookId: 1,
				organizationId: 1,
				event: "test",
				data: testCase.data,
				timestamp: "2023-01-01T00:00:00Z",
			};

			const result = validatePayload(type as JobType, payload);
			expect(result.success).toBe(true);
		});
	});
});
