import type { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit, withRateLimiting } from "@/lib/rate-limit-wrapper";

// Mock the rate limit dependency
vi.mock("@/lib/api-rate-limit", () => ({
  withRateLimit: vi.fn(),
}));

describe("Rate Limit Wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("withRateLimiting", () => {
    it("should wrap handler with rate limiting using default tier", async () => {
      const { withRateLimit } = await import("@/lib/api-rate-limit");

      // Mock the rate limit function to return the handler response
      const mockResponse = { status: 200, json: async () => ({ success: true }) } as NextResponse;
      vi.mocked(withRateLimit).mockResolvedValueOnce(mockResponse);

      // Create a test handler
      const testHandler = vi.fn().mockResolvedValueOnce(mockResponse);
      const wrappedHandler = withRateLimiting(testHandler);

      // Create a mock request
      const mockRequest = {} as NextRequest;

      // Call the wrapped handler
      const result = await wrappedHandler(mockRequest);

      // Verify the rate limit was called with correct parameters
      expect(withRateLimit).toHaveBeenCalledWith(mockRequest, testHandler, { customTier: "free" });

      // Verify the result
      expect(result).toBe(mockResponse);
    });

    it("should wrap handler with rate limiting using custom tier", async () => {
      const { withRateLimit } = await import("@/lib/api-rate-limit");

      // Mock the rate limit function to return the handler response
      const mockResponse = { status: 200, json: async () => ({ success: true }) } as NextResponse;
      vi.mocked(withRateLimit).mockResolvedValueOnce(mockResponse);

      // Create a test handler
      const testHandler = vi.fn().mockResolvedValueOnce(mockResponse);
      const wrappedHandler = withRateLimiting(testHandler, "enterprise");

      // Create a mock request
      const mockRequest = {} as NextRequest;

      // Call the wrapped handler
      const result = await wrappedHandler(mockRequest);

      // Verify the rate limit was called with correct parameters
      expect(withRateLimit).toHaveBeenCalledWith(mockRequest, testHandler, {
        customTier: "enterprise",
      });

      // Verify the result
      expect(result).toBe(mockResponse);
    });

    it("should pass through all request arguments to handler", async () => {
      const { withRateLimit } = await import("@/lib/api-rate-limit");

      // Mock the rate limit function to call the handler
      const mockResponse = { status: 200, json: async () => ({ success: true }) } as NextResponse;
      vi.mocked(withRateLimit).mockImplementationOnce(async (req, handler) => {
        return await handler(req);
      });

      // Create a test handler that expects the request
      const testHandler = vi.fn().mockResolvedValueOnce(mockResponse);
      const wrappedHandler = withRateLimiting(testHandler, "pro");

      // Create a mock request
      const mockRequest = { url: "https://example.com" } as NextRequest;

      // Call the wrapped handler
      await wrappedHandler(mockRequest);

      // Verify the handler was called with the request
      expect(testHandler).toHaveBeenCalledWith(mockRequest);
    });
  });

  describe("rateLimit", () => {
    it("should create HOC that wraps handler with rate limiting using default tier", async () => {
      const { withRateLimit } = await import("@/lib/api-rate-limit");

      // Mock the rate limit function to return the handler response
      const mockResponse = { status: 200, json: async () => ({ success: true }) } as NextResponse;
      vi.mocked(withRateLimit).mockResolvedValueOnce(mockResponse);

      // Create a test handler function
      const testHandler = vi.fn().mockResolvedValueOnce(mockResponse);

      // Apply the HOC
      const wrappedHandler = rateLimit()(testHandler);

      // Create a mock request
      const mockRequest = {} as NextRequest;

      // Call the wrapped handler
      const result = await wrappedHandler(mockRequest);

      // Verify the rate limit was called with correct parameters
      expect(withRateLimit).toHaveBeenCalledWith(mockRequest, expect.any(Function), {
        customTier: "free",
      });

      // Verify the result
      expect(result).toBe(mockResponse);
    });

    it("should create HOC that wraps handler with rate limiting using custom tier", async () => {
      const { withRateLimit } = await import("@/lib/api-rate-limit");

      // Mock the rate limit function to return the handler response
      const mockResponse = { status: 200, json: async () => ({ success: true }) } as NextResponse;
      vi.mocked(withRateLimit).mockResolvedValueOnce(mockResponse);

      // Create a test handler function
      const testHandler = vi.fn().mockResolvedValueOnce(mockResponse);

      // Apply the HOC with custom tier
      const wrappedHandler = rateLimit("anonymous")(testHandler);

      // Create a mock request
      const mockRequest = {} as NextRequest;

      // Call the wrapped handler
      const result = await wrappedHandler(mockRequest);

      // Verify the rate limit was called with correct parameters
      expect(withRateLimit).toHaveBeenCalledWith(mockRequest, expect.any(Function), {
        customTier: "anonymous",
      });

      // Verify the result
      expect(result).toBe(mockResponse);
    });

    it("should pass through all arguments to original handler via HOC", async () => {
      const { withRateLimit } = await import("@/lib/api-rate-limit");

      // Mock the rate limit function to call the inner handler
      const mockResponse = { status: 200, json: async () => ({ success: true }) } as NextResponse;
      vi.mocked(withRateLimit).mockImplementationOnce(async (req, handler) => {
        return await handler();
      });

      // Create a test handler that expects arguments
      const testHandler = vi.fn().mockResolvedValueOnce(mockResponse);

      // Apply the HOC
      const wrappedHandler = rateLimit("pro")(testHandler);

      // Create mock arguments
      const mockRequest = {} as NextRequest;
      const mockArg1 = "arg1";
      const mockArg2 = { data: "test" };

      // Call the wrapped handler with arguments
      await wrappedHandler(mockRequest, mockArg1, mockArg2);

      // Verify the original handler was called with all arguments
      expect(testHandler).toHaveBeenCalledWith(mockRequest, mockArg1, mockArg2);
    });

    it("should preserve handler return type through HOC", async () => {
      const { withRateLimit } = await import("@/lib/api-rate-limit");

      // Mock the rate limit function to return the handler response
      const mockResponse = { status: 201, json: async () => ({ created: true }) } as NextResponse;
      vi.mocked(withRateLimit).mockResolvedValueOnce(mockResponse);

      // Create a test handler with specific return type
      const testHandler = vi.fn().mockResolvedValueOnce(mockResponse);

      // Apply the HOC
      const wrappedHandler = rateLimit("enterprise")(testHandler);

      // Call the wrapped handler
      const result = await wrappedHandler({} as NextRequest);

      // Verify the return type is preserved
      expect(result).toBe(mockResponse);
      expect(result.status).toBe(201);
    });
  });
});
