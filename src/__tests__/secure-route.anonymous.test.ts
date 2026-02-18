/**
 * secureRoute anonymous path tests
 *
 * Verifies allowAnonymous permits unauthenticated access with explicit
 * ctx.authType === 'anonymous' and rate limiting applied.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { secureRoute } from '@/lib/api/secure-route';

// Mock rate limit to avoid actual rate limiting in tests
vi.mock('@/lib/api-rate-limit', () => ({
  withRateLimit: vi.fn(
    async (
      _req: NextRequest,
      handler: (req: NextRequest) => Promise<NextResponse>,
    ) => handler(_req),
  ),
}));

describe('secureRoute allowAnonymous', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls handler with authType: anonymous when no auth header', async () => {
    let capturedCtx: { authType?: string } = {};
    const handler = vi.fn(async (_req, ctx) => {
      capturedCtx = ctx;
      return NextResponse.json({ ok: true });
    });

    const wrapped = secureRoute(handler, {
      allowAnonymous: true,
      rateLimit: 'anonymous',
    });

    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
    });
    const res = await wrapped(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(capturedCtx.authType).toBe('anonymous');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('applies rate limiting for anonymous requests', async () => {
    const { withRateLimit } = await import('@/lib/api-rate-limit');

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = secureRoute(handler, {
      allowAnonymous: true,
      rateLimit: 'anonymous',
    });

    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
    });
    await wrapped(req, { params: Promise.resolve({}) });

    expect(withRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.any(Function),
      { customTier: 'anonymous' },
    );
  });

  it('uses custom tier when rateLimit specified', async () => {
    const { withRateLimit } = await import('@/lib/api-rate-limit');

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = secureRoute(handler, {
      allowAnonymous: true,
      rateLimit: 'free',
    });

    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
    });
    await wrapped(req, { params: Promise.resolve({}) });

    expect(withRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.any(Function),
      { customTier: 'free' },
    );
  });
});
