#!/usr/bin/env npx tsx
/**
 * Run migrations for test database. Called before vitest.
 */
import { runMigrations } from './run-migrations';
import { resolve } from 'node:path';

const testDb = resolve(process.cwd(), 'test.db').replace(/\\/g, '/');
await runMigrations({
  url: `file:${testDb}`,
  authToken: 'test-token',
  silent: true,
});
