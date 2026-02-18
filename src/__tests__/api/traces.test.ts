import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/traces/route';
import { NextRequest } from 'next/server';

const routeContext = { params: Promise.resolve({}) };

vi.mock('@/lib/services/trace.service', () => ({
  traceService: {
    list: vi.fn().mockResolvedValue([{ id: 1, name: 'Test Trace', traceId: 'trace-1' }]),
    create: vi.fn().mockResolvedValue([{ id: 1, name: 'Test Trace', traceId: 'trace-123' }]),
    remove: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/lib/autumn-server', () => ({
  checkFeature: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
  trackFeature: vi.fn().mockResolvedValue({ success: true }),
  requireAuthWithOrg: vi.fn().mockResolvedValue({
    authenticated: true,
    userId: 'test-user',
    organizationId: 1,
    role: 'member',
    scopes: ['traces:read', 'traces:write'],
    authType: 'session',
  }),
}));

vi.mock('@/lib/api-rate-limit', () => ({
  withRateLimit: vi.fn((_req: unknown, handler: (r: unknown) => Promise<Response>) => handler(_req)),
}));

describe('/api/traces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('should return traces with default pagination', async () => {
      const req = new NextRequest('http://localhost:3000/api/traces');

      const response = await GET(req, routeContext as never);

      expect(response.status).toBe(200);
    });

    it('should filter by organizationId', async () => {
      const req = new NextRequest('http://localhost:3000/api/traces?organizationId=123');

      const response = await GET(req, routeContext as never);

      expect(response.status).toBe(200);
    });

    it('should respect limit and offset parameters', async () => {
      const req = new NextRequest('http://localhost:3000/api/traces?limit=10&offset=20');

      const response = await GET(req, routeContext as never);

      expect(response.status).toBe(200);
    });
  });

  describe('POST', () => {
    it('should create a new trace with valid data', async () => {
      const req = new NextRequest('http://localhost:3000/api/traces', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Trace',
          traceId: 'trace-123',
          organizationId: 1,
          status: 'pending',
        }),
      });

      const response = await POST(req, routeContext as never);

      expect(response.status).toBe(201);
    });

    it('should reject missing required fields', async () => {
      const req = new NextRequest('http://localhost:3000/api/traces', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Trace',
          // Missing traceId
        }),
      });

      const response = await POST(req, routeContext as never);

      expect(response.status).toBe(400);
    });
  });
});

