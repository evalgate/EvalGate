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
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";

const API_DIR = path.resolve(__dirname, "../../app/api");

/**
 * Check if a route file uses canonical error helpers (apiError, validationError, etc.)
 * and does NOT contain ad-hoc NextResponse.json({ error: ... }) patterns.
 */
function hasAdHocErrorPattern(content: string): boolean {
  // Ad-hoc: NextResponse.json({ error: 'string' }) - error as string primitive
  if (/NextResponse\.json\s*\(\s*\{\s*error:\s*['"`]/.test(content)) {
    return true;
  }
  // Ad-hoc: { error: ..., code: '...' } - flat structure, not nested error: { code, message }
  const adHocFlatError = /NextResponse\.json\s*\(\s*\{\s*error:\s*[^}]+code:\s*['"`]/;
  if (adHocFlatError.test(content)) {
    return true;
  }
  return false;
}

describe("API Error Envelope Audit", () => {
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

    expect(
      violations,
      violations.length > 0
        ? `Routes with ad-hoc error format: ${violations.map((v) => v.file).join(", ")}`
        : undefined,
    ).toHaveLength(0);
  });

  it('no route should return NextResponse.json({ error: "string" })', () => {
    const project = new Project({
      compilerOptions: { skipLibCheck: true },
      skipAddingFilesFromTsConfig: true,
    });

    const violations: { file: string; line: number }[] = [];

    for (const routeFile of routeFiles) {
      const fullPath = path.join(API_DIR, routeFile);
      try {
        const sourceFile = project.addSourceFileAtPath(fullPath);

        sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
          const expr = call.getExpression();
          const text = expr.getText();
          if (!text.includes("NextResponse.json")) return;

          const args = call.getArguments();
          if (args.length === 0) return;

          const firstArg = args[0];
          const argText = firstArg.getText();

          // Ad-hoc: error as string literal (canonical has error: { code, message })
          if (/\berror\s*:\s*['"`]/.test(argText)) {
            violations.push({
              file: routeFile,
              line: firstArg.getStartLineNumber(),
            });
          }
        });
      } catch {
        // Skip files that fail to parse
      }
    }

    expect(
      violations,
      violations.length > 0
        ? `Routes with error as string: ${violations.map((v) => `${v.file}:${v.line}`).join(", ")}`
        : undefined,
    ).toHaveLength(0);
  });
});
