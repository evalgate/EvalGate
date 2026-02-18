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

import { createClient } from '@libsql/client';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const content = await readFile(join(process.cwd(), f), 'utf-8');
      for (const line of content.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
      break;
    } catch {
      /* file not found */
    }
  }
}

function parseStatements(sql: string): string[] {
  const parts = sql.includes('--> statement-breakpoint')
    ? sql.split(/--> statement-breakpoint/)
    : sql.split(/;\s*\n/);
  return parts
    .map((s) => {
      const trimmed = s.trim().replace(/\s*;\s*$/, '');
      // Strip leading comment lines so statements like "-- comment\nCREATE ..." are kept
      return trimmed.replace(/^\s*--[^\n]*\n?/gm, '').trim();
    })
    .filter((s) => s.length > 0);
}

async function main() {
  await loadEnv();

  const url = process.env.TURSO_CONNECTION_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error('TURSO_CONNECTION_URL is required. Set it in .env.local or .env');
    process.exit(1);
  }

  const only = process.argv.slice(2); // e.g. ['0016', '0017']
  const client = createClient({
    url,
    authToken: authToken || undefined,
  });

  const files = await readdir(join(process.cwd(), 'drizzle'));
  const sqlFiles = files
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => only.length === 0 || only.some((o) => f.startsWith(o)))
    .sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
      const numB = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
      return numA - numB;
    });

  if (sqlFiles.length === 0) {
    console.log(only.length ? `No migrations match: ${only.join(', ')}` : 'No migration files found.');
    return;
  }

  console.log(`Running ${sqlFiles.length} migration(s)...\n`);

  for (const file of sqlFiles) {
    const path = join(process.cwd(), 'drizzle', file);
    const content = await readFile(path, 'utf-8');
    const statements = parseStatements(content);

    if (statements.length === 0) {
      console.log(`  [skip] ${file} (no statements)`);
      continue;
    }

    let applied = 0;
    let skipped = 0;
    for (const stmt of statements) {
      const s = stmt.trim();
      if (!s || s.startsWith('--')) continue;
      const sql = s.endsWith(';') ? s : s + ';';
      try {
        await client.execute(sql);
        applied++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isSkip =
          msg.includes('duplicate column') ||
          msg.includes('already exists') ||
          msg.includes('no such table') ||
          msg.includes('UNIQUE constraint failed');
        if (isSkip) {
          if (msg.includes('UNIQUE constraint failed')) {
            console.warn(`  [skip] ${file}: ${msg} (fix duplicate data and re-run to apply constraint)`);
          }
          skipped++;
        } else {
          console.error(`  [fail] ${file}: ${msg}`);
          throw err;
        }
      }
    }
    if (applied > 0 || skipped > 0) {
      console.log(`  [ok]   ${file} (${applied} applied${skipped > 0 ? `, ${skipped} skipped` : ''})`);
    }
  }

  console.log('\nDone.');
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
