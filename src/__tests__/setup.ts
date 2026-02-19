// Set test DB env before any module imports db (test:db-setup creates test.db before vitest)
import { resolve } from "node:path";

const testDb = resolve(process.cwd(), "test.db").replace(/\\/g, "/");
process.env.TURSO_CONNECTION_URL = `file:${testDb}`;
process.env.TURSO_AUTH_TOKEN = "test-token";

import { beforeAll } from "vitest";
import { db } from "@/db";
import { organizations, user } from "@/db/schema";

// Setup for tests (migrations run via pnpm test:db-setup before vitest)
beforeAll(async () => {
  // Seed minimal data for FK constraints (user, org) used by MCP usage tracking
  const now = new Date();
  try {
    await db
      .insert(user)
      .values({
        id: "test-user",
        name: "Test User",
        email: "test@example.com",
        emailVerified: false,
      })
      .onConflictDoNothing();
    const existingOrg = await db.select().from(organizations).limit(1);
    if (existingOrg.length === 0) {
      await db.insert(organizations).values({
        name: "Test Org",
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch {
    // Ignore if already seeded
  }
});
