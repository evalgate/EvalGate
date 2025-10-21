import { beforeAll, afterEach, afterAll } from 'vitest';

// Setup for tests
beforeAll(() => {
  // Mock environment variables
  process.env.TURSO_CONNECTION_URL = 'file:test.db';
  process.env.TURSO_AUTH_TOKEN = 'test-token';
});

afterEach(() => {
  // Clear mocks after each test
});

afterAll(() => {
  // Cleanup
});

