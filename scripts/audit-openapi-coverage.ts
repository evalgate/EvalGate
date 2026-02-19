#!/usr/bin/env npx tsx
/**
 * OpenAPI Coverage Audit
 *
 * Compares API route files to OpenAPI spec paths. Fails if documented
 * coverage drops below threshold, preventing spec drift.
 *
 * Run: pnpm exec tsx scripts/audit-openapi-coverage.ts
 * Or:  pnpm run audit:openapi
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { globSync } from "glob";

const API_DIR = path.resolve(process.cwd(), "src/app/api");
const OPENAPI_JSON = path.resolve(process.cwd(), "docs/openapi.json");
const MIN_COVERAGE = 0.8; // 80% — fail if coverage drops below

// Routes we don't expect in public OpenAPI (internal, auth, demo, etc.)
const EXCLUDE_FROM_DOC_COVERAGE = [
  "auth",
  "debug",
  "demo",
  "docs",
  "health",
  "sentry-example-api",
  "autumn",
  "billing-portal",
  "costs/pricing",
  "onboarding",
  "org/switch",
  "subscribers",
  "r/[shareToken]", // share link redirect
];

function routeFileToApiPath(routeFile: string): string {
  const normalized = routeFile.replace(/\\/g, "/").replace(/\/route\.ts$/, "");
  const segments = normalized.split("/").map((s) => {
    if (s.startsWith("[") && s.endsWith("]")) {
      return `{${s.slice(1, -1)}}`;
    }
    return s;
  });
  return `/api/${segments.join("/")}`;
}

function isExcluded(routeFile: string): boolean {
  const normalized = routeFile.replace(/\\/g, "/");
  return EXCLUDE_FROM_DOC_COVERAGE.some(
    (prefix) => normalized.includes(prefix) || normalized.startsWith(prefix),
  );
}

function main(): number {
  const routeFiles = globSync("**/route.ts", { cwd: API_DIR });
  const docWorthyRoutes = routeFiles.filter((f) => !isExcluded(f));
  const docWorthyPaths = new Set(docWorthyRoutes.map(routeFileToApiPath));

  const openApi = JSON.parse(readFileSync(OPENAPI_JSON, "utf-8"));
  const openApiPaths = new Set(Object.keys(openApi.paths || {}));

  // Paths in OpenAPI that match our routes (exact or prefix for nested)
  const documented = [...docWorthyPaths].filter((p) => {
    if (openApiPaths.has(p)) return true;
    // Check if we have a more specific path (e.g. /api/evaluations/{id} covers /api/evaluations/{id}/runs)
    return [...openApiPaths].some(
      (doc) =>
        doc === p || (doc.startsWith(`${p}/`) && p.split("/").length <= doc.split("/").length),
    );
  });

  // Simpler: exact match only for now
  const documentedExact = [...docWorthyPaths].filter((p) => openApiPaths.has(p));
  const coverage = docWorthyPaths.size > 0 ? documentedExact.length / docWorthyPaths.size : 1;

  console.log("OpenAPI Coverage Audit");
  console.log("=====================");
  console.log(`Doc-worthy routes: ${docWorthyPaths.size}`);
  console.log(`Documented in OpenAPI: ${documentedExact.length}`);
  console.log(`Coverage: ${(coverage * 100).toFixed(1)}%`);
  console.log(`Threshold: ${(MIN_COVERAGE * 100).toFixed(0)}%`);

  if (coverage < MIN_COVERAGE) {
    const missing = [...docWorthyPaths].filter((p) => !openApiPaths.has(p));
    console.log("\nMissing from OpenAPI (sample):");
    missing.slice(0, 15).forEach((p) => console.log(`  - ${p}`));
    if (missing.length > 15) {
      console.log(`  ... and ${missing.length - 15} more`);
    }
    console.error(
      `\nFAIL: OpenAPI coverage ${(coverage * 100).toFixed(1)}% < ${MIN_COVERAGE * 100}%`,
    );
    return 1;
  }

  console.log("\nPASS");
  return 0;
}

process.exit(main());
