#!/usr/bin/env npx tsx
/**
 * Data retention audit — asserts:
 * - Exports include expiresAt when set
 * - Expired exports return 410 with SHARE_EXPIRED
 * - Revoked exports return 410 with SHARE_REVOKED
 * - Deletion/revocation removes access immediately
 *
 * Runs the exports-contract tests which cover these invariants.
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

async function main(): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(
      "pnpm",
      [
        "exec",
        "vitest",
        "run",
        "-c",
        "vitest.db.config.ts",
        "tests/api/exports-contract.test.ts",
        "--reporter=verbose",
      ],
      {
        cwd: root,
        stdio: "inherit",
        shell: true,
      },
    );

    proc.on("close", (code) => {
      if (code !== 0) {
        console.error("audit:retention — FAIL (exports-contract tests failed)");
        resolve(1);
      } else {
        console.log("audit:retention — PASS (retention invariants verified)");
        resolve(0);
      }
    });
  });
}

main().then((code) => process.exit(code));
