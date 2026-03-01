/**
 * parseBody Audit Test
 *
 * Verifies that migrated routes (Slice 1: evaluations, Slice 2: traces, webhooks, api-keys)
 * use parseBody() instead of raw req.json(). Documents remaining routes for future migration.
 *
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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

const API_DIR = path.resolve(__dirname, "../../src/app/api");

/** Routes that must use parseBody (migrated in T0.2) */
const MUST_USE_PARSE_BODY = [
	"evaluations/route",
	"evaluations/[id]/route",
	"evaluations/[id]/runs/route",
	"evaluations/[id]/publish-run/route",
	"evaluations/[id]/test-cases/route",
	"traces/route",
	"traces/[id]/route",
	"developer/api-keys/route",
	"developer/api-keys/[id]/route",
	"developer/webhooks/route",
	"developer/webhooks/[id]/route",
	"developer/webhooks/[id]/deliveries/route",
];

function usesReqJson(content: string): boolean {
	return /\breq\.json\(\)/.test(content);
}

function usesParseBody(content: string): boolean {
	return /parseBody\(req\)/.test(content);
}

function hasPostPutPatch(content: string): boolean {
	return (
		/\bexport\s+const\s+POST\s*=/.test(content) ||
		/\bexport\s+const\s+PUT\s*=/.test(content) ||
		/\bexport\s+const\s+PATCH\s*=/.test(content)
	);
}

describe("parseBody Audit", () => {
	const routeFiles = walkRouteFiles(API_DIR);

	it("should find route files", () => {
		expect(routeFiles.length).toBeGreaterThan(0);
	});

	it("migrated routes must use parseBody for JSON body parsing", () => {
		const violations: { file: string }[] = [];

		for (const routeFile of routeFiles) {
			const normalized = routeFile.replace(/\\/g, "/");
			if (
				!MUST_USE_PARSE_BODY.some(
					(p) => normalized.startsWith(p) || normalized.includes(`${p}/`),
				)
			)
				continue;

			const fullPath = path.join(API_DIR, routeFile);
			const content = readFileSync(fullPath, "utf-8");

			if (
				hasPostPutPatch(content) &&
				usesReqJson(content) &&
				!usesParseBody(content)
			) {
				violations.push({ file: routeFile });
			}
		}

		expect(violations).toEqual([]);
	});

	it("documents remaining routes using req.json()", () => {
		const remaining: { file: string }[] = [];

		for (const routeFile of routeFiles) {
			const fullPath = path.join(API_DIR, routeFile);
			const content = readFileSync(fullPath, "utf-8");

			if (hasPostPutPatch(content) && usesReqJson(content)) {
				remaining.push({ file: routeFile });
			}
		}

		// This documents the current state - not a failure
		expect(remaining.length).toBeGreaterThanOrEqual(0);
		console.log(`Routes still using req.json(): ${remaining.length}`);
	});
});
