import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/traces/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1, name: 'Test Trace' }]),
  },
}));

vi.mock('@/lib/autumn-server', () => ({
  requireFeature: vi.fn().mockResolvedValue({ allowed: true, userId: 'test-user' }),
  trackFeature: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/api-rate-limit', () => ({
  withRateLimit: vi.fn((req, handler) => handler(req)),
}));

describe('/api/traces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('should return traces with default pagination', async () => {
      const req = new NextRequest('http://localhost:3000/api/traces');
      
      const response = await GET(req);
      
      expect(response.status).toBe(200);
    });

    it('should filter by organizationId', async () => {
      const req = new NextRequest('http://localhost:3000/api/traces?organizationId=123');
      
      const response = await GET(req);
      
      expect(response.status).toBe(200);
    });

    it('should respect limit and offset parameters', async () => {
      const req = new NextRequest('http://localhost:3000/api/traces?limit=10&offset=20');
      
      const response = await GET(req);
      
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

      const response = await POST(req);
      
      expect(response.status).toBe(201);
    });

    it('should reject missing required fields', async () => {
      const req = new NextRequest('http://localhost:3000/api/traces', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Trace',
          // Missing traceId and organizationId
        }),
      });

      const response = await POST(req);
      
      expect(response.status).toBe(400);
    });
  });
});

