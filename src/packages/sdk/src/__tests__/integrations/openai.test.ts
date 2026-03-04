import { describe, expect, it, vi } from "vitest";
import { traceOpenAICall } from "../../integrations/openai";

function createMockClient(overrides: Record<string, unknown> = {}) {
	return {
		traces: overrides.traces !== undefined ? overrides.traces : null,
		getOrganizationId: overrides.getOrganizationId ?? (() => 1),
		...overrides,
	} as any;
}

describe("traceOpenAICall — non-fatal trace handling", () => {
	it("should return fn() result even when traces is null", async () => {
		const client = createMockClient({ traces: null });
		const result = await traceOpenAICall(client, "test", async () => "hello");
		expect(result).toBe("hello");
	});

	it("should return fn() result even when getOrganizationId throws", async () => {
		const client = createMockClient({
			traces: {
				create: vi.fn().mockResolvedValue({ id: 1 }),
			},
			getOrganizationId: () => {
				throw new Error("Organization ID is required");
			},
		});
		const result = await traceOpenAICall(client, "test", async () => "hello");
		expect(result).toBe("hello");
	});

	it("should return fn() result even when trace creation rejects", async () => {
		const client = createMockClient({
			traces: {
				create: vi.fn().mockRejectedValue(new Error("API down")),
			},
		});
		const result = await traceOpenAICall(client, "test", async () => "hello");
		expect(result).toBe("hello");
	});

	it("should re-throw fn() errors", async () => {
		const client = createMockClient({ traces: null });
		await expect(
			traceOpenAICall(client, "test", async () => {
				throw new Error("boom");
			}),
		).rejects.toThrow("boom");
	});

	it("should still attempt error trace when fn() throws", async () => {
		const mockCreate = vi.fn().mockResolvedValue({ id: 1 });
		const client = createMockClient({
			traces: { create: mockCreate },
		});
		await expect(
			traceOpenAICall(client, "test", async () => {
				throw new Error("fn failed");
			}),
		).rejects.toThrow("fn failed");
		// Should have called create for pending + error traces
		expect(mockCreate).toHaveBeenCalledTimes(2);
	});
});
