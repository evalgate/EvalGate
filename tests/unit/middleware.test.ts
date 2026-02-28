/**
 * Unit test for middleware nonce-based CSP.
 * Runs in unit lane — no DB imports.
 */
import { describe, expect, it, vi } from "vitest";

// Mock the polyfill import (no-op in tests)
vi.mock("@/lib/polyfill-global", () => ({}));

// Minimal NextRequest/NextResponse mocks
class MockHeaders {
	private store = new Map<string, string>();
	get(key: string) {
		return this.store.get(key.toLowerCase()) ?? null;
	}
	set(key: string, value: string) {
		this.store.set(key.toLowerCase(), value);
	}
	has(key: string) {
		return this.store.has(key.toLowerCase());
	}
	entries() {
		return this.store.entries();
	}
	forEach(cb: (value: string, key: string) => void) {
		this.store.forEach(cb);
	}
	[Symbol.iterator]() {
		return this.store[Symbol.iterator]();
	}
}

vi.mock("next/server", () => {
	return {
		NextResponse: {
			next: vi.fn(({ request }: { request?: { headers?: unknown } } = {}) => {
				const res = {
					headers: new MockHeaders(),
					_requestHeaders: request?.headers,
				};
				return res;
			}),
		},
	};
});

// Mock crypto.randomUUID for deterministic nonce
vi.stubGlobal("crypto", {
	randomUUID: vi.fn(() => "test-nonce-uuid-1234"),
});

import { middleware } from "../../middleware";

describe("middleware", () => {
	function createMockRequest(env: Record<string, string> = {}) {
		const originalEnv = { ...process.env };
		for (const [k, v] of Object.entries(env)) {
			process.env[k] = v;
		}
		const headers = new MockHeaders();
		const req = { headers } as any;
		return { req, cleanup: () => Object.assign(process.env, originalEnv) };
	}

	it("should generate a nonce and include it in CSP header", () => {
		const { req } = createMockRequest();
		const response = middleware(req);
		const csp = response.headers.get("content-security-policy");
		expect(csp).toContain("'nonce-test-nonce-uuid-1234'");
	});

	it("should not include unsafe-inline in script-src", () => {
		const { req } = createMockRequest();
		const response = middleware(req);
		const csp = response.headers.get("content-security-policy");
		// Extract script-src directive
		const scriptSrc = csp
			?.split(";")
			.find((d: string) => d.trim().startsWith("script-src"));
		expect(scriptSrc).toBeDefined();
		expect(scriptSrc).not.toContain("'unsafe-inline'");
	});

	it("should include strict-dynamic in script-src", () => {
		const { req } = createMockRequest();
		const response = middleware(req);
		const csp = response.headers.get("content-security-policy");
		expect(csp).toContain("'strict-dynamic'");
	});

	it("should keep unsafe-inline in style-src", () => {
		const { req } = createMockRequest();
		const response = middleware(req);
		const csp = response.headers.get("content-security-policy");
		const styleSrc = csp
			?.split(";")
			.find((d: string) => d.trim().startsWith("style-src"));
		expect(styleSrc).toContain("'unsafe-inline'");
	});

	it("should set X-Content-Type-Options header", () => {
		const { req } = createMockRequest();
		const response = middleware(req);
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	});

	it("should set X-Frame-Options header", () => {
		const { req } = createMockRequest();
		const response = middleware(req);
		expect(response.headers.get("x-frame-options")).toBe("DENY");
	});

	it("should not include unsafe-eval in production", () => {
		const { req, cleanup } = createMockRequest({ NODE_ENV: "production" });
		const response = middleware(req);
		const csp = response.headers.get("content-security-policy");
		const scriptSrc = csp
			?.split(";")
			.find((d: string) => d.trim().startsWith("script-src"));
		expect(scriptSrc).not.toContain("'unsafe-eval'");
		cleanup();
	});

	it("should include unsafe-eval in development", () => {
		const { req, cleanup } = createMockRequest({
			NODE_ENV: "development",
			VERCEL_ENV: "",
		});
		const response = middleware(req);
		const csp = response.headers.get("content-security-policy");
		const scriptSrc = csp
			?.split(";")
			.find((d: string) => d.trim().startsWith("script-src"));
		expect(scriptSrc).toContain("'unsafe-eval'");
		cleanup();
	});

	it("should pass nonce via x-nonce request header", () => {
		const { req } = createMockRequest();
		const response = middleware(req);
		// The nonce should be forwarded on the request headers for layout.tsx
		const requestHeaders = (response as any)._requestHeaders;
		expect(requestHeaders).toBeDefined();
	});
});
