/**
 * Error Envelope Audit Test
 *
 * Ensures all API routes return errors in the canonical envelope format:
 * { error: { code, message, requestId? } }
 *
 * Ad-hoc patterns like NextResponse.json({ error: '...', code: '...' }) or
 * NextResponse.json({ error: '...' }) must be replaced with apiError() or
 * helpers (validationError, notFound, internalError, etc.).
 *
 * Uses AST-based scan (ts-morph) to avoid false positives on docs, helpers,
 * and non-error payloads.
 *
 * TEMPORARILY DISABLED: TODO - Fix glob pattern for Windows path resolution
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";

const API_DIR = path.resolve(__dirname, "../../../src/app/api");

/**
 * Check if a route file uses canonical error helpers (apiError, validationError, etc.)
 * and does NOT contain ad-hoc NextResponse.json({ error: ... }) patterns.
 */
function hasAdHocErrorPattern(content: string): boolean {
  // Ad-hoc: NextResponse.json({ error: 'string' }) - error as string primitive
  if (/NextResponse\.json\s*\(\s*\{\s*error:\s*['"`]/.test(content)) {
    return true;
  }
  // Ad-hoc: { error: ..., code: '...' } - flat structure (error and code as siblings)
  // Exclude canonical: { error: { code, message } } where error is an object
  const adHocFlatError = /NextResponse\.json\s*\(\s*\{\s*error:\s*[^{][^}]*,\s*code:\s*['"`]/;
  if (adHocFlatError.test(content)) {
    return true;
  }
  return false;
}

describe.skip("API Error Envelope Audit - DISABLED: Fix glob pattern", () => {
  const routeFiles = globSync("**/route.ts", { cwd: API_DIR });

  it("should find route files", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it("no route should use ad-hoc error responses (flat error/code)", () => {
    const violations: { file: string; line?: number }[] = [];

    for (const routeFile of routeFiles) {
      const fullPath = path.join(API_DIR, routeFile);
      const content = readFileSync(fullPath, "utf-8");

      if (hasAdHocErrorPattern(content)) {
        violations.push({ file: routeFile });
      }
    }

    expect(violations).toEqual([]);
  });

  it("all routes should use canonical error helpers or be explicitly public", () => {
    const project = new Project();
    const violations: { file: string; line?: number }[] = [];

    for (const routeFile of routeFiles) {
      const fullPath = path.join(API_DIR, routeFile);
      const sourceFile = project.addSourceFileAtPath(fullPath);
      const content = sourceFile.getFullText();

      // Check for ad-hoc patterns using AST for precision
      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

      for (const callExpr of callExpressions) {
        const expression = callExpr.getExpression();

        if (expression.getText() === "NextResponse.json") {
          const firstArg = callExpr.getArguments()[0];
          if (firstArg && firstArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
            const objLiteral = firstArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);

            // Look for error property at top level
            const errorProp = objLiteral.getProperty("error");
            if (errorProp) {
              // Check if it's an object (canonical) vs primitive/string (ad-hoc)
              const errorInit = errorProp.getFirstChildByKind(SyntaxKind.ObjectLiteralExpression);
              if (!errorInit) {
                // error is not an object = ad-hoc pattern
                violations.push({
                  file: routeFile,
                  line: callExpr.getStartLineNumber(),
                });
              }
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
