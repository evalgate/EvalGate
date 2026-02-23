import { expect, test } from "@playwright/test";

/**
 * Smoke tests — critical path only.
 * Verifies: public pages load, auth-gated endpoints return correct status.
 * Not a full E2E suite. Keep this file minimal.
 */

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AI Evaluation Platform/i);
  // Hero section is visible
  await expect(page.locator("h1").first()).toBeVisible();
  // No error boundary triggered
  await expect(page.getByText("Application error")).not.toBeVisible();
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

test("public pricing page loads", async ({ page }) => {
  await page.goto("/pricing");
  // Page renders without error
  await expect(page.locator("body")).toBeVisible();
  // No server error page
  await expect(page.locator("text=Application error")).not.toBeVisible();
  await expect(page.locator("text=Internal Server Error")).not.toBeVisible();
});

test("/api/health/deep returns 401 or 403 when unauthenticated", async ({ request }) => {
  const response = await request.get("/api/health/deep");
  // Must be auth-gated — never 200 for anonymous callers
  expect([401, 403]).toContain(response.status());
});
