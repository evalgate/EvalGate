import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/request-id", () => ({
	getRequestId: vi.fn(() => "test-req-id"),
}));

vi.mock("@/lib/logger", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

import { classifyDatabaseError } from "@/lib/api/errors";

describe("classifyDatabaseError", () => {
	it("returns 409 for Postgres unique violation (23505)", async () => {
		const error = { code: "23505", message: "duplicate key" };
		const response = classifyDatabaseError(error);

		expect(response).not.toBeNull();
		expect(response?.status).toBe(409);

		const body = await response?.json();
		expect(body.error.code).toBe("CONFLICT");
		expect(body.error.message).toBe("Resource already exists");
	});

	it("returns 409 for Postgres foreign key violation (23503)", async () => {
		const error = { code: "23503", message: "foreign key constraint" };
		const response = classifyDatabaseError(error);

		expect(response).not.toBeNull();
		expect(response?.status).toBe(409);

		const body = await response?.json();
		expect(body.error.code).toBe("REFERENCE_ERROR");
		expect(body.error.message).toBe("Referenced resource not found");
	});

	it('returns 503 for connection errors containing "connection"', async () => {
		const error = { message: "connection refused to database" };
		const response = classifyDatabaseError(error);

		expect(response).not.toBeNull();
		expect(response?.status).toBe(503);

		const body = await response?.json();
		expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
	});

	it("returns 503 for ECONNREFUSED errors", async () => {
		const error = { message: "connect ECONNREFUSED 127.0.0.1:5432" };
		const response = classifyDatabaseError(error);

		expect(response).not.toBeNull();
		expect(response?.status).toBe(503);

		const body = await response?.json();
		expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
	});

	it("returns 503 for ENOTFOUND errors", async () => {
		const error = { message: "getaddrinfo ENOTFOUND db.example.com" };
		const response = classifyDatabaseError(error);

		expect(response).not.toBeNull();
		expect(response?.status).toBe(503);
	});

	it("returns null for unknown / unrecognised errors", () => {
		const error = { code: "42P01", message: "relation does not exist" };
		const response = classifyDatabaseError(error);

		expect(response).toBeNull();
	});

	it("returns null for plain Error objects with no PG code or connection message", () => {
		const error = new Error("something went wrong");
		const response = classifyDatabaseError(error);

		expect(response).toBeNull();
	});
});
