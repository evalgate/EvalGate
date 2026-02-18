#!/usr/bin/env npx tsx
/**
 * One-time script to revoke API keys that have wildcard scope ["*"].
 *
 * Run after deploying validateSession wildcard rejection.
 * Usage: pnpm tsx scripts/revoke-wildcard-keys.ts
 *
 * Requires TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN in .env.local or .env.
 */

import { readFile } from 'node:fs/promises';
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

import { db } from '@/db';
import { apiKeys } from '@/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

async function main() {
  await loadEnv();

  // Find keys where scopes JSON contains "*" (e.g. ["*"] or ["eval:read","*"])
  const badKeys = await db
    .select({ id: apiKeys.id, keyPrefix: apiKeys.keyPrefix, scopes: apiKeys.scopes })
    .from(apiKeys)
    .where(
      and(
        sql`${apiKeys.scopes} LIKE '%"*"%'`,
        isNull(apiKeys.revokedAt),
      ),
    );

  if (badKeys.length === 0) {
    console.log('No wildcard-scope API keys found. Nothing to revoke.');
    return;
  }

  console.log(`Found ${badKeys.length} API key(s) with wildcard scope. Revoking...`);

  for (const k of badKeys) {
    await db
      .update(apiKeys)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(apiKeys.id, k.id));
    console.log(`  Revoked: ${k.keyPrefix} (id=${k.id})`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
