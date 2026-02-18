#!/usr/bin/env npx tsx

/**
 * Run Drizzle migrations in numerical order.
 *
 * Usage:
 *   pnpm tsx scripts/run-migrations.ts              # run all
 *   pnpm tsx scripts/run-migrations.ts 0016 0017    # run only 0016 and 0017
 *
 * Requires TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN in .env.local or .env.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

async function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      const content = await readFile(join(process.cwd(), f), "utf-8");
      for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
      break;
    } catch {
      /* file not found */
    }
  }
}

function parseStatements(sql: string): string[] {
  const parts = sql.includes("--> statement-breakpoint")
    ? sql.split(/--> statement-breakpoint/)
    : sql.split(/;\s*\n/);
  return parts
    .map((s) => {
      const trimmed = s.trim().replace(/\s*;\s*$/, "");
      // Strip leading comment lines so statements like "-- comment\nCREATE ..." are kept
      return trimmed.replace(/^\s*--[^\n]*\n?/gm, "").trim();
    })
    .filter((s) => s.length > 0);
}

export type RunMigrationsOptions = {
  url?: string;
  authToken?: string;
  only?: string[];
  silent?: boolean;
};

/**
 * Run migrations against a database. Used by CLI and test setup.
 * When url/authToken omitted, loads from .env.
 */
export async function runMigrations(options: RunMigrationsOptions = {}): Promise<void> {
  const { url: optUrl, authToken: optAuthToken, only = [], silent = false } = options;

  let url = optUrl;
  let authToken = optAuthToken;

  if (!url || authToken === undefined) {
    await loadEnv();
    url = url ?? process.env.TURSO_CONNECTION_URL;
    authToken = authToken ?? process.env.TURSO_AUTH_TOKEN;
  }

  if (!url) {
    throw new Error(
      "TURSO_CONNECTION_URL is required. Set it in .env.local, .env, or pass to runMigrations.",
    );
  }

  const client = createClient({
    url,
    authToken: authToken || undefined,
  });

  const files = await readdir(join(process.cwd(), "drizzle"));
  const sqlFiles = files
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => only.length === 0 || only.some((o) => f.startsWith(o)))
    .sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)?.[1] ?? "0", 10);
      const numB = parseInt(b.match(/^(\d+)/)?.[1] ?? "0", 10);
      return numA - numB;
    });

  if (sqlFiles.length === 0) {
    if (!silent) {
      console.log(
        only.length ? `No migrations match: ${only.join(", ")}` : "No migration files found.",
      );
    }
    client.close();
    return;
  }

  if (!silent) {
    console.log(`Running ${sqlFiles.length} migration(s)...\n`);
  }

  for (const file of sqlFiles) {
    const path = join(process.cwd(), "drizzle", file);
    const content = await readFile(path, "utf-8");
    const statements = parseStatements(content);

    if (statements.length === 0) {
      if (!silent) console.log(`  [skip] ${file} (no statements)`);
      continue;
    }

    let applied = 0;
    let skipped = 0;
    for (const stmt of statements) {
      const s = stmt.trim();
      if (!s || s.startsWith("--")) continue;
      const sql = s.endsWith(";") ? s : `${s};`;
      try {
        await client.execute(sql);
        applied++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isSkip =
          msg.includes("duplicate column") ||
          msg.includes("already exists") ||
          msg.includes("no such table") ||
          msg.includes("no such column") ||
          msg.includes("UNIQUE constraint failed");
        if (isSkip) {
          if (msg.includes("UNIQUE constraint failed") && !silent) {
            console.warn(
              `  [skip] ${file}: ${msg} (fix duplicate data and re-run to apply constraint)`,
            );
          }
          skipped++;
        } else {
          if (!silent) console.error(`  [fail] ${file}: ${msg}`);
          client.close();
          throw err;
        }
      }
    }
    if (!silent && (applied > 0 || skipped > 0)) {
      console.log(
        `  [ok]   ${file} (${applied} applied${skipped > 0 ? `, ${skipped} skipped` : ""})`,
      );
    }
  }

  if (!silent) {
    console.log("\nDone.");
  }
  client.close();
}

async function main() {
  const only = process.argv.slice(2);
  await runMigrations({ only: only.length > 0 ? only : undefined });
}

// Only run when executed directly (not when imported)
const __filename = fileURLToPath(import.meta.url);
const isEntryPoint =
  process.argv[1] === __filename ||
  process.argv[1]?.replace(/\\/g, "/") === __filename.replace(/\\/g, "/") ||
  process.argv[1]?.endsWith("run-migrations.ts");
if (isEntryPoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
