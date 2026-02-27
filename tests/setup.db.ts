// DB integration test setup - PGlite (in-process PostgreSQL, no Docker needed)
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, vi } from "vitest";
import * as schema from "@/db/schema";
import { organizations, user } from "@/db/schema";

// Create an in-memory PGlite instance per worker
const workerId = process.env.VITEST_WORKER_ID ?? process.pid;
const pg = new PGlite();

// Expose a DATABASE_URL that the app code won't use directly — instead we
// override the db export below. But scripts that read DATABASE_URL will see this.
process.env.DATABASE_URL = `pglite://memory-${workerId}`;

// PGlite doesn't accept a connection URL via postgres.js, so we run migrations
// directly using PGlite's exec method with the SQL files.
const drizzleDir = join(process.cwd(), "drizzle");
const files = await readdir(drizzleDir);
const sqlFiles = files
  .filter((f) => f.endsWith(".sql"))
  .sort((a, b) => {
    const numA = parseInt(a.match(/^(\d+)/)?.[1] ?? "0", 10);
    const numB = parseInt(b.match(/^(\d+)/)?.[1] ?? "0", 10);
    return numA - numB;
  });

for (const file of sqlFiles) {
  const content = await readFile(join(drizzleDir, file), "utf-8");
  // Split on statement-breakpoint markers so each statement runs independently
  const statements = content.includes("--> statement-breakpoint")
    ? content.split(/--> statement-breakpoint/)
    : [content];
  for (const raw of statements) {
    const stmt = raw.trim();
    if (!stmt) continue;
    try {
      await pg.exec(stmt);
    } catch {
      // Skip migration errors (already exists, etc.)
    }
  }
}

// Create the drizzle db instance using PGlite
const testDb = drizzle(pg, { schema });

// Mock the @/db module to use our PGlite-backed drizzle instance
vi.mock("@/db", () => ({ db: testDb }));

beforeAll(async () => {
  // Seed minimal data for FK constraints (user, org) used by MCP usage tracking
  const now = new Date();
  try {
    await testDb
      .insert(user)
      .values({
        id: "test-user",
        name: "Test User",
        email: "test@example.com",
        emailVerified: false,
      })
      .onConflictDoNothing();
    const existingOrg = await testDb.select().from(organizations).limit(1);
    if (existingOrg.length === 0) {
      await testDb.insert(organizations).values({
        name: "Test Org",
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch {
    // Ignore if already seeded
  }
});

console.log("[setup.db] PGlite loaded");
