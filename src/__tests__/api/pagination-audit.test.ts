/**
 * Pagination Audit Test
 *
 * Ensures list endpoints that use limit/offset query params import and use
 * parsePaginationParams from @/lib/validation for consistency.
 *
 * Endpoints that manually parse parseInt(searchParams.get("limit")) or similar
 * should be migrated to use parsePaginationParams.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";

const API_DIR = path.resolve(__dirname, "../../app/api");

function usesManualPagination(content: string): boolean {
  return (
    /parseInt\s*\(\s*searchParams\.get\s*\(\s*["']limit["']\s*\)/.test(content) ||
    /parseInt\s*\(\s*searchParams\.get\s*\(\s*["']offset["']\s*\)/.test(content)
  );
}

function usesParsePaginationParams(content: string): boolean {
  return (
    content.includes("parsePaginationParams") &&
    content.includes("parsePaginationParams(searchParams)")
  );
}

describe("API Pagination Audit", () => {
  const routeFiles = globSync("**/route.ts", { cwd: API_DIR });

  it("list endpoints with limit/offset should use parsePaginationParams", () => {
    const violations: string[] = [];

    for (const routeFile of routeFiles) {
      const fullPath = path.join(API_DIR, routeFile);
      const content = readFileSync(fullPath, "utf-8");

      if (usesManualPagination(content) && !usesParsePaginationParams(content)) {
        violations.push(routeFile);
      }
    }

    expect(
      violations,
      `These routes use manual limit/offset parsing; migrate to parsePaginationParams: ${violations.join(", ")}`,
    ).toHaveLength(0);
  });
});
