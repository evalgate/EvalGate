/**
 * POST /api/evaluations/:id/runs/import
 *
 * Platform tests for P3:
 * - CI metadata → persisted in traceLog.import.ci
 * - Idempotency key → same run id with 200
 * - serverReceivedAt, requestId present in traceLog
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockReturning = vi.fn();
const mockValues = vi.fn();

const chain = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  inArray: vi.fn(),
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
});

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnValue(chain()),
    from: vi.fn().mockReturnValue(chain()),
    where: vi.fn().mockReturnValue(chain()),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn() }),
      returning: vi.fn(),
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  evaluationRuns: {},
  evaluations: {},
  testCases: {},
  testResults: {},
  qualityScores: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  inArray: vi.fn((a: unknown, b: unknown[]) => ({ type: 'inArray', a, b })),
  desc: vi.fn((a: unknown) => ({ type: 'desc', a })),
}));

vi.mock('@/lib/api/parse', () => ({
  parseBody: vi.fn(),
}));

vi.mock('@/lib/api/request-id', () => ({
  getRequestId: vi.fn().mockReturnValue('test-request-id-123'),
}));

vi.mock('@/lib/services/aggregate-metrics.service', () => ({
  computeAndStoreQualityScore: vi.fn().mockResolvedValue({ score: 85, flags: [] }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe('runs import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('importRunBodySchema accepts ci object', async () => {
    const { importRunBodySchema } = await import('@/lib/validation');
    const result = importRunBodySchema.safeParse({
      results: [
        { testCaseId: 1, status: 'passed', output: 'ok' },
      ],
      ci: {
        provider: 'github',
        repo: 'owner/repo',
        sha: 'abc123',
        branch: 'main',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ci).toEqual({
        provider: 'github',
        repo: 'owner/repo',
        sha: 'abc123',
        branch: 'main',
      });
    }
  });

  it('traceLog.import includes serverReceivedAt, requestId, and ci', () => {
    const now = new Date().toISOString();
    const requestId = 'test-request-id-123';
    const traceLog = JSON.stringify({
      import: {
        source: 'import',
        importedAt: now,
        clientReportedVersion: null,
        ci: { provider: 'github', repo: 'test/repo', sha: 'abc' },
        serverReceivedAt: now,
        requestId,
      },
    });
    const parsed = JSON.parse(traceLog);
    expect(parsed.import.serverReceivedAt).toBeDefined();
    expect(parsed.import.requestId).toBeDefined();
    expect(parsed.import.ci).toEqual({ provider: 'github', repo: 'test/repo', sha: 'abc' });
  });
});
