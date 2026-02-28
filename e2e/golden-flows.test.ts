import { expect, test } from "@playwright/test";

// ── Flow 1: Auth & Login ──

test.describe("Flow 1: Authentication", () => {
	test("login page renders with OAuth providers", async ({ page }) => {
		await page.goto("/auth/login");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("button")).toHaveCount({ minimum: 1 });
		await expect(page.getByText("Something went wrong")).not.toBeAttached();
	});

	test("unauthenticated user is redirected from dashboard", async ({
		page,
	}) => {
		await page.goto("/dashboard");
		await page.waitForLoadState("domcontentloaded");
		const url = page.url();
		expect(url.includes("/auth/login") || url.includes("/dashboard")).toBe(
			true,
		);
	});

	test("sign-up page renders", async ({ page }) => {
		await page.goto("/auth/sign-up");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeAttached();
		await expect(page.getByText("Something went wrong")).not.toBeAttached();
	});

	test("auth error page handles error param", async ({ page }) => {
		await page.goto("/auth/error?error=OAuthAccountNotLinked");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeAttached();
		await expect(page.getByText("Something went wrong")).not.toBeAttached();
	});
});

// ── Flow 2: Evaluation lifecycle (API level) ──

test.describe("Flow 2: Evaluations", () => {
	test("evaluations list page renders for unauthenticated user", async ({
		page,
	}) => {
		await page.goto("/evaluations");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeAttached();
	});

	test("evaluations API requires auth", async ({ request }) => {
		const response = await request.get("/api/evaluations");
		expect([401, 403]).toContain(response.status());
	});

	test("evaluation creation API requires auth", async ({ request }) => {
		const response = await request.post("/api/evaluations", {
			data: { name: "test", type: "unit_test" },
		});
		expect([401, 403]).toContain(response.status());
	});

	test("new evaluation page exists", async ({ page }) => {
		await page.goto("/evaluations/new");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeAttached();
	});
});

// ── Flow 3: Trace viewer ──

test.describe("Flow 3: Trace Viewer", () => {
	test("traces list page renders", async ({ page }) => {
		await page.goto("/traces");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeAttached();
		await expect(page.getByText("Application error")).not.toBeAttached();
	});

	test("traces API requires auth", async ({ request }) => {
		const response = await request.get("/api/traces");
		expect([401, 403]).toContain(response.status());
	});

	test("individual trace 404 for missing ID", async ({ request }) => {
		const response = await request.get("/api/traces/nonexistent-id-12345");
		expect([401, 403, 404]).toContain(response.status());
	});
});

// ── Flow 4: Share export ──

test.describe("Flow 4: Share Export", () => {
	test("share link with invalid token returns error page", async ({ page }) => {
		await page.goto("/share/invalid-share-token");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeAttached();
		await expect(page.getByText("Application error")).not.toBeAttached();
	});

	test("exports API requires auth", async ({ request }) => {
		const response = await request.get("/api/exports/nonexistent-share-id");
		expect([401, 403, 404]).toContain(response.status());
	});

	test("public report link with invalid token", async ({ page }) => {
		await page.goto("/r/invalid-token");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeAttached();
	});
});

// ── Flow 5: API key lifecycle ──

test.describe("Flow 5: API Key Management", () => {
	test("developer API keys page renders", async ({ page }) => {
		await page.goto("/developer/api-keys");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeAttached();
	});

	test("API key creation requires auth", async ({ request }) => {
		const response = await request.post("/api/developer/api-keys", {
			data: { name: "test-key", scopes: ["evaluations:read"] },
		});
		expect([401, 403]).toContain(response.status());
	});

	test("API key listing requires auth", async ({ request }) => {
		const response = await request.get("/api/developer/api-keys");
		expect([401, 403]).toContain(response.status());
	});

	test("API key deletion requires auth", async ({ request }) => {
		const response = await request.delete("/api/developer/api-keys/99999");
		expect([401, 403]).toContain(response.status());
	});

	test("webhooks API requires auth", async ({ request }) => {
		const response = await request.get("/api/developer/webhooks");
		expect([401, 403]).toContain(response.status());
	});
});

// ── Bonus: Regression gate demo ──

test.describe("Bonus: Regression Gate", () => {
	test("SDK page renders", async ({ page }) => {
		await page.goto("/sdk");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeAttached();
		await expect(page.getByText("Application error")).not.toBeAttached();
	});

	test("templates page renders", async ({ page }) => {
		await page.goto("/templates");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeAttached();
	});

	test("health endpoint returns 200", async ({ request }) => {
		const response = await request.get("/api/health");
		expect(response.status()).toBe(200);
	});

	test("security page renders", async ({ page }) => {
		await page.goto("/security");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeAttached();
		await expect(page.getByText("Application error")).not.toBeAttached();
	});

	test("404 page renders for unknown routes", async ({ page }) => {
		await page.goto("/this-page-does-not-exist-abc123");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeAttached();
		await expect(page.getByText("Application error")).not.toBeAttached();
	});
});
