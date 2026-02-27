#!/usr/bin/env npx tsx

/**
 * Run Drizzle migrations in numerical order.
 *
 * Usage:
 *   pnpm tsx scripts/run-migrations.ts              # run all
 *   pnpm tsx scripts/run-migrations.ts 0016 0017    # run only 0016 and 0017
 *
 * Requires DATABASE_URL in .env.local or .env.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

async function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      const content = await readFile(join(process.cwd(), f), "utf-8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const idx = line.indexOf("=");
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        const val = line
          .slice(idx + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
        if (key) process.env[key] = val;
      }
      break;
    } catch {
      /* file not found */
    }
  }
}

function parseStatements(sqlContent: string): string[] {
  const parts = sqlContent.includes("--> statement-breakpoint")
    ? sqlContent.split(/--> statement-breakpoint/)
    : sqlContent.split(/;\s*\n/);
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
  only?: string[];
  silent?: boolean;
};

/**
 * Run migrations against a database. Used by CLI and test setup.
 * When url omitted, loads from .env.
 */
export async function runMigrations(options: RunMigrationsOptions = {}): Promise<void> {
  const { url: optUrl, only = [], silent = false } = options;

  let url = optUrl;

  if (!url) {
    await loadEnv();
    url = process.env.DATABASE_URL;
  }

  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Set it in .env.local, .env, or pass to runMigrations.",
    );
  }

  const sql = postgres(url, { max: 1 });

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
    await sql.end();
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
      try {
        await sql.unsafe(s);
        applied++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isSkip =
          msg.includes("duplicate column") ||
          msg.includes("already exists") ||
          msg.includes("does not exist") ||
          msg.includes("unique_violation");
        if (isSkip) {
          if (msg.includes("unique_violation") && !silent) {
            console.warn(
              `  [skip] ${file}: ${msg} (fix duplicate data and re-run to apply constraint)`,
            );
          }
          skipped++;
        } else {
          if (!silent) console.error(`  [fail] ${file}: ${msg}`);
          await sql.end();
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
  await sql.end();
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
