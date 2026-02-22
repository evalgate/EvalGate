#!/usr/bin/env npx tsx
import { resolve } from "node:path";
/**
 * Run migrations for test database. Called before vitest.
 */
import { runMigrations } from "./run-migrations.js";

const testDb = resolve(process.cwd(), "test.db").replace(/\\/g, "/");
await runMigrations({
  url: `file:${testDb}`,
  authToken: "test-token",
  silent: true,
});
