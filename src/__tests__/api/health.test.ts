import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/health/route';
import { NextRequest } from 'next/server';

// Mock database to avoid actual connection
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([{ '1': 1 }])),
      })),
    })),
  },
}));

describe('/api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch for Redis ping
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ result: 'PONG' }),
    } as Response));
  });

  it('should return health status', async () => {
    const req = new NextRequest('http://localhost:3000/api/health');
    
    const response = await GET(req);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('uptime');
  });

  it('should include database check', async () => {
    const req = new NextRequest('http://localhost:3000/api/health');
    
    const response = await GET(req);
    const data = await response.json();
    
    expect(data.checks).toHaveProperty('database');
    expect(data.checks.database).toHaveProperty('status');
    expect(data.checks.database.status).toBe('healthy');
  });

  it('should include redis check', async () => {
    const req = new NextRequest('http://localhost:3000/api/health');
    
    const response = await GET(req);
    const data = await response.json();
    
    expect(data.checks).toHaveProperty('redis');
    expect(data.checks.redis).toHaveProperty('status');
  });
});

