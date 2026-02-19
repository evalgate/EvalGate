/**
 * Cookie-first auth regression test.
 *
 * Asserts that browser-authenticated pages use `credentials: "include"` and
 * never send an `Authorization: Bearer …` header sourced from localStorage.
 *
 * This is a static-analysis style test: it greps the source tree so that any
 * future PR re-introducing localStorage bearer tokens will break CI.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// ── helpers ──

const SRC_ROOT = join(process.cwd(), "src");

/** Recursively collect .ts / .tsx files, skipping node_modules and __tests__ */
function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === "__tests__" || entry === ".next") continue;
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Directories whose fetch calls represent browser-authenticated requests. */
const BROWSER_AUTH_DIRS = [
  "src/app/(authenticated)",
  "src/app/onboarding",
  "src/components",
  "src/hooks",
  "src/lib/autumn-provider.tsx",
];

function isBrowserAuthFile(absPath: string): boolean {
  const rel = relative(process.cwd(), absPath).replace(/\\/g, "/");
  return BROWSER_AUTH_DIRS.some((d) => rel.startsWith(d));
}

// ── tests ──

describe("Cookie-first auth invariants", () => {
  const files = collectSourceFiles(SRC_ROOT);

  it("no browser-auth file reads bearer_token from localStorage", () => {
    const violations: string[] = [];

    for (const file of files) {
      if (!isBrowserAuthFile(file)) continue;
      const content = readFileSync(file, "utf-8");
      if (content.includes('localStorage.getItem("bearer_token")')) {
        violations.push(relative(process.cwd(), file).replace(/\\/g, "/"));
      }
    }

    expect(
      violations,
      `Files still reading bearer_token from localStorage:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("no browser-auth file imports getBearerToken", () => {
    const violations: string[] = [];

    for (const file of files) {
      if (!isBrowserAuthFile(file)) continue;
      const content = readFileSync(file, "utf-8");
      // Match import statements that pull getBearerToken
      if (/import\s.*getBearerToken/.test(content)) {
        violations.push(relative(process.cwd(), file).replace(/\\/g, "/"));
      }
    }

    expect(violations, `Files still importing getBearerToken:\n${violations.join("\n")}`).toEqual(
      [],
    );
  });

  it("no browser-auth file sets Authorization header with a bearer token variable", () => {
    const violations: string[] = [];
    // Matches patterns like:  Authorization: `Bearer ${token}`  or  Authorization: "Bearer " + token
    const BEARER_HEADER_RE = /Authorization:\s*[`"']Bearer\s/;

    for (const file of files) {
      if (!isBrowserAuthFile(file)) continue;
      const content = readFileSync(file, "utf-8");
      if (BEARER_HEADER_RE.test(content)) {
        violations.push(relative(process.cwd(), file).replace(/\\/g, "/"));
      }
    }

    expect(
      violations,
      `Files still sending Authorization: Bearer header:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("auth-client.ts does not persist tokens to localStorage", () => {
    const authClient = readFileSync(join(SRC_ROOT, "lib", "auth-client.ts"), "utf-8");

    expect(authClient).not.toContain("localStorage.setItem");
    expect(authClient).not.toContain("localStorage.getItem");
    expect(authClient).not.toContain("localStorage.removeItem");
  });
});
