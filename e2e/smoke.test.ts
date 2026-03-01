import { expect, test } from "@playwright/test";

/**
 * Smoke tests — critical path only.
 * Verifies: public pages load, auth-gated endpoints return correct status.
 * Not a full E2E suite. Keep this file minimal.
 */

test("home page loads", async ({ page }) => {
	await page.goto("/");
	await page.waitForLoadState("domcontentloaded");
	await expect(page).toHaveTitle(/EvalGate|Stop LLM Regressions/i);
	// Hero section is present in DOM
	await expect(page.locator("h1").first()).toBeAttached();
	// No error boundary triggered
	await expect(page.getByText("Application error")).not.toBeAttached();
	await expect(page.getByText("Something went wrong")).not.toBeAttached();
});

test("public pricing page loads", async ({ page }) => {
	await page.goto("/pricing");
	await page.waitForLoadState("domcontentloaded");
	// Page renders without error
	await expect(page.locator("body")).toBeAttached();
	// No server error page
	await expect(page.locator("text=Application error")).not.toBeAttached();
	await expect(page.locator("text=Internal Server Error")).not.toBeAttached();
});

test("security page loads", async ({ page }) => {
	await page.goto("/security");
	await page.waitForLoadState("domcontentloaded");
	await expect(page.locator("body")).toBeAttached();
	await expect(page.getByText("Application error")).not.toBeAttached();
});

test("changelog page loads", async ({ page }) => {
	await page.goto("/changelog");
	await page.waitForLoadState("domcontentloaded");
	await expect(page.locator("body")).toBeAttached();
	await expect(page.getByText("Application error")).not.toBeAttached();
});

test("/api/health/deep returns 401 or 403 when unauthenticated", async ({
	request,
}) => {
	const response = await request.get("/api/health/deep");
	// Must be auth-gated — never 200 for anonymous callers
	expect([401, 403]).toContain(response.status());
});
