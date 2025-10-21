import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOrganizationId } from '@/hooks/use-organization';

// Mock fetch
global.fetch = vi.fn();

describe('useOrganizationId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'test-token'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });
  });

  it('should return organization ID when fetched', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ organization: { id: 123 } }),
    });

    const { result } = renderHook(() => useOrganizationId());

    await waitFor(() => {
      expect(result.current).toBe(123);
    });
  });

  it('should return null while loading', () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useOrganizationId());

    expect(result.current).toBe(null);
  });
});

