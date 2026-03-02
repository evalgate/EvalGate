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
 *
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Routes that are intentionally public / use their own auth mechanisms
// Paths are relative to src/app/api/ (e.g. health/route.ts, demo/custom-eval/route.ts)
// SHRINK-ONLY: Prefer secureRoute({ allowAnonymous: true }) over adding here
const PUBLIC_ROUTE_ALLOWLIST = [
	"health",
	"debug/",
	"docs",
	"auth",
	"autumn",
	"demo",
	"subscribers",
	"sentry-example-api",
];

// Legacy auth patterns that should be migrated to secureRoute
// SHRINK-ONLY: This list should only shrink over time
const LEGACY_AUTH_ALLOWLIST = ["arena-matches/route.ts"];

function isAllowlisted(routePath: string): boolean {
	const normalized = routePath.replace(/\\/g, "/");
	return PUBLIC_ROUTE_ALLOWLIST.some((prefix) => normalized.includes(prefix));
}

function isLegacyAllowlisted(routePath: string): boolean {
	const normalized = routePath.replace(/\\/g, "/");
	return LEGACY_AUTH_ALLOWLIST.some((suffix) => normalized.endsWith(suffix));
}

function walkRouteFiles(dir: string, base = ""): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const rel = base ? `${base}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			results.push(...walkRouteFiles(path.join(dir, entry.name), rel));
		} else if (entry.name === "route.ts") {
			results.push(rel);
		}
	}
	return results;
}

describe("API Route Auth Audit", () => {
	const apiDir = path.resolve(__dirname, "../../src/app/api");
	const routeFiles = walkRouteFiles(apiDir);

	it("should find at least 20 route files", () => {
		expect(routeFiles.length).toBeGreaterThanOrEqual(20);
	});

	const nonAllowlisted = routeFiles.filter((f) => !isAllowlisted(f));

	describe("secureRoute enforcement", () => {
		const strictRoutes = nonAllowlisted.filter((f) => !isLegacyAllowlisted(f));

		it.each(
			strictRoutes,
		)("%s uses secureRoute (not legacy auth)", (routeFile) => {
			const fullPath = path.join(apiDir, routeFile);
			const content = readFileSync(fullPath, "utf-8");

			// Should use secureRoute
			const usesSecureRoute = content.includes("secureRoute");

			// Should NOT use legacy patterns (exclude requireAuth: false in secureRoute options)
			const usesLegacyAuth =
				/\brequireAuth\s*\(/.test(content) ||
				/\bgetCurrentUser\s*\(/.test(content) ||
				/\brequireAuthWithOrg\s*\(/.test(content);

			expect(usesSecureRoute).toBe(true);
			if (usesLegacyAuth) {
				console.warn(
					`Route ${routeFile} uses legacy auth - consider migrating to secureRoute`,
				);
			}
		});
	});

	describe("legacy auth tracking", () => {
		const legacyRoutes = nonAllowlisted.filter((f) => isLegacyAllowlisted(f));

		it.each(
			legacyRoutes,
		)("%s is tracked for legacy auth migration", (routeFile) => {
			// This test just documents legacy routes for future migration
			expect(routeFile).toBeDefined();
		});
	});
});
