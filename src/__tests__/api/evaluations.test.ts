import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/evaluations/route';
import { NextRequest } from 'next/server';

// Create a mock inline to avoid hoisting issues
vi.mock('@/db', () => {
  const mockChain: any = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    $dynamic: vi.fn(),
  };
  
  // Make all methods return the mock itself for chaining, except final ones
  mockChain.select.mockReturnValue(mockChain);
  mockChain.from.mockReturnValue(mockChain);
  mockChain.$dynamic.mockReturnValue(mockChain);
  mockChain.where.mockReturnValue(mockChain);
  mockChain.orderBy.mockReturnValue(mockChain);
  mockChain.limit.mockReturnValue(mockChain);
  mockChain.offset.mockResolvedValue([]);
  
  return {
    db: mockChain,
  };
});

vi.mock('@/lib/api-rate-limit', () => ({
  withRateLimit: vi.fn((req, handler) => handler(req)),
}));

vi.mock('@/lib/autumn-server', () => ({
  requireFeature: vi.fn(),
  trackFeature: vi.fn(),
}));

describe('/api/evaluations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('should return evaluations list', async () => {
      const req = new NextRequest('http://localhost:3000/api/evaluations');
      
      const response = await GET(req);
      
      expect(response.status).toBe(200);
    });

    it('should support search parameter', async () => {
      const req = new NextRequest('http://localhost:3000/api/evaluations?search=test');
      
      const response = await GET(req);
      
      expect(response.status).toBe(200);
    });

    it('should support pagination', async () => {
      const req = new NextRequest('http://localhost:3000/api/evaluations?limit=20&offset=40');
      
      const response = await GET(req);
      
      expect(response.status).toBe(200);
    });
  });
});

