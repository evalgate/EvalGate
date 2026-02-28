import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getCorsHeaders", () => {
	const ORIGINAL_ENV = process.env;

	beforeEach(() => {
		vi.resetModules();
		process.env = { ...ORIGINAL_ENV };
	});

	afterEach(() => {
		process.env = ORIGINAL_ENV;
	});

	async function loadCors(env?: Record<string, string>) {
		if (env) {
			Object.assign(process.env, env);
		}
		const mod = await import("@/lib/api/cors");
		return mod.getCorsHeaders;
	}

	it("returns correct headers when origin is in the allowlist", async () => {
		const getCorsHeaders = await loadCors({
			CORS_ALLOWED_ORIGINS: "https://example.com,https://other.com",
			NODE_ENV: "production",
		});

		const headers = getCorsHeaders("https://example.com");

		expect(headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
		expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
		expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
		expect(headers["Access-Control-Max-Age"]).toBe("86400");
	});

	it("returns empty object when origin is NOT in the allowlist", async () => {
		const getCorsHeaders = await loadCors({
			CORS_ALLOWED_ORIGINS: "https://allowed.com",
			NODE_ENV: "production",
		});

		const headers = getCorsHeaders("https://evil.com");

		expect(headers).toEqual({});
	});

	it("returns empty object when origin is null", async () => {
		const getCorsHeaders = await loadCors({
			CORS_ALLOWED_ORIGINS: "https://allowed.com",
			NODE_ENV: "production",
		});

		const headers = getCorsHeaders(null);

		expect(headers).toEqual({});
	});

	it("sets Vary: Origin when reflecting an allowed origin", async () => {
		const getCorsHeaders = await loadCors({
			CORS_ALLOWED_ORIGINS: "https://example.com",
			NODE_ENV: "production",
		});

		const headers = getCorsHeaders("https://example.com");

		expect(headers.Vary).toBe("Origin");
	});

	it("includes Authorization in allowed headers for SSE/API key auth", async () => {
		const getCorsHeaders = await loadCors({
			CORS_ALLOWED_ORIGINS: "https://example.com",
			NODE_ENV: "production",
		});

		const headers = getCorsHeaders("https://example.com");

		expect(headers["Access-Control-Allow-Headers"]).toContain("Authorization");
	});

	it("automatically allows localhost origins in non-production", async () => {
		const getCorsHeaders = await loadCors({
			CORS_ALLOWED_ORIGINS: "",
			NODE_ENV: "development",
		});

		const headers3000 = getCorsHeaders("http://localhost:3000");
		expect(headers3000["Access-Control-Allow-Origin"]).toBe(
			"http://localhost:3000",
		);

		const headers3001 = getCorsHeaders("http://localhost:3001");
		expect(headers3001["Access-Control-Allow-Origin"]).toBe(
			"http://localhost:3001",
		);
	});

	it("does NOT auto-allow localhost in production", async () => {
		const getCorsHeaders = await loadCors({
			CORS_ALLOWED_ORIGINS: "",
			NODE_ENV: "production",
		});

		const headers = getCorsHeaders("http://localhost:3000");

		expect(headers).toEqual({});
	});
});
