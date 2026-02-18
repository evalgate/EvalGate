/**
 * Route Auth Audit Test
 *
 * Ensures every API route either uses `secureRoute` or is in the explicit
 * public allowlist. Legacy auth patterns (requireAuthWithOrg, requireAuth,
 * getCurrentUser) are flagged as tech debt needing migration.
 *
 * SHRINK-ONLY: The allowlists must only shrink over time. Do NOT add new
 * routes to LEGACY_AUTH_ALLOWLIST — migrate them to secureRoute instead.
 * New routes MUST use secureRoute or be added to PUBLIC_ROUTE_ALLOWLIST
 * (for intentionally public endpoints). Fail the suite if new legacy routes
 * appear without migration.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";

// Routes that are intentionally public / use their own auth mechanisms
// Paths are relative to src/app/api/ (e.g. health/route.ts, demo/custom-eval/route.ts)
// SHRINK-ONLY: Prefer secureRoute({ allowAnonymous: true }) over adding here
const PUBLIC_ROUTE_ALLOWLIST = [
  "health",
  "debug/",
  "docs",
  "auth",
  "demo",
  "subscribers",
  "sentry-example-api",
  "autumn",
  "billing-portal",
  "costs/pricing",
  "onboarding",
  "org/switch",
];

// Routes still using legacy auth that should be migrated to secureRoute
// Paths relative to src/app/api/ (e.g. evaluations/route.ts)
// SHRINK-ONLY: Do NOT add to this list. Migrate to secureRoute instead.
const LEGACY_AUTH_ALLOWLIST: string[] = [];

function isAllowlisted(routePath: string): boolean {
  const normalized = routePath.replace(/\\/g, "/");
  return PUBLIC_ROUTE_ALLOWLIST.some((prefix) => normalized.includes(prefix));
}

function isLegacyAllowlisted(routePath: string): boolean {
  const normalized = routePath.replace(/\\/g, "/");
  return LEGACY_AUTH_ALLOWLIST.some((suffix) => normalized.endsWith(suffix));
}

describe("API Route Auth Audit", () => {
  const apiDir = path.resolve(__dirname, "../../app/api");
  const routeFiles = globSync("**/route.ts", { cwd: apiDir });

  it("should find at least 20 route files", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(20);
  });

  const nonAllowlisted = routeFiles.filter((f) => !isAllowlisted(f));

  describe("secureRoute enforcement", () => {
    const strictRoutes = nonAllowlisted.filter((f) => !isLegacyAllowlisted(f));

    it.each(strictRoutes)("%s uses secureRoute (not legacy auth)", (routeFile) => {
      const fullPath = path.join(apiDir, routeFile);
      const content = readFileSync(fullPath, "utf-8");

      expect(content).toContain("secureRoute");
    });
  });

  describe("legacy routes have SOME auth", () => {
    const legacyRoutes = nonAllowlisted.filter((f) => isLegacyAllowlisted(f));

    if (legacyRoutes.length > 0) {
      it.each(legacyRoutes)("%s uses some auth pattern (legacy)", (routeFile) => {
        const fullPath = path.join(apiDir, routeFile);
        const content = readFileSync(fullPath, "utf-8");

        const usesSecureRoute = content.includes("secureRoute");
        const usesRequireAuth =
          content.includes("requireAuthWithOrg") ||
          content.includes("requireAuth(") ||
          content.includes("requireAdmin");
        const usesGetCurrentUser = content.includes("getCurrentUser");

        expect(usesSecureRoute || usesRequireAuth || usesGetCurrentUser).toBe(true);
      });
    } else {
      it("all routes migrated to secureRoute", () => {
        expect(LEGACY_AUTH_ALLOWLIST).toHaveLength(0);
      });
    }
  });

  it("legacy allowlist must shrink over time (no new additions)", () => {
    expect(LEGACY_AUTH_ALLOWLIST.length).toBeLessThanOrEqual(8);
  });

  it("legacy allowlist should be empty (all routes migrated)", () => {
    expect(LEGACY_AUTH_ALLOWLIST.length).toBe(0);
  });
});
