import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActionData, getActionError, protectedAction } from "@/lib/actions/protected";

// Mock the dependencies
vi.mock("@/lib/autumn-server", () => ({
  requireAuthWithOrg: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("Protected Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("protectedAction", () => {
    it("should wrap handler and return success result when authentication passes", async () => {
      const { requireAuthWithOrg } = await import("@/lib/autumn-server");
      const { cookies } = await import("next/headers");

      // Mock successful authentication
      vi.mocked(requireAuthWithOrg).mockResolvedValueOnce({
        authenticated: true,
        userId: "user123",
        organizationId: 456,
      });

      // Mock cookies with session token
      const mockGet = vi.fn().mockReturnValue({
        value: "session-token-123",
      });
      vi.mocked(cookies).mockResolvedValueOnce({
        get: mockGet,
      } as any);

      // Create a test handler
      const testHandler = vi.fn().mockResolvedValueOnce({ result: "success" });
      const protectedHandler = protectedAction(testHandler);

      // Call the protected handler
      const result = await protectedHandler("arg1", "arg2");

      // Verify the result
      expect(result).toEqual({
        success: true,
        data: { result: "success" },
      });

      // Verify the handler was called with correct context
      expect(testHandler).toHaveBeenCalledWith(
        { userId: "user123", organizationId: 456 },
        "arg1",
        "arg2",
      );

      // Verify authentication was called
      expect(requireAuthWithOrg).toHaveBeenCalledWith(expect.any(Request));
    });

    it("should return error result when authentication fails", async () => {
      const { requireAuthWithOrg } = await import("@/lib/autumn-server");
      const { cookies } = await import("next/headers");

      // Mock failed authentication
      const mockResponse = {
        json: vi.fn().mockResolvedValueOnce({ error: "Unauthorized access" }),
      };
      vi.mocked(requireAuthWithOrg).mockResolvedValueOnce({
        authenticated: false,
        response: mockResponse,
      });

      // Mock cookies without session token
      const mockGet = vi.fn().mockReturnValue(undefined);
      vi.mocked(cookies).mockResolvedValueOnce({
        get: mockGet,
      } as any);

      // Create a test handler (should not be called)
      const testHandler = vi.fn();
      const protectedHandler = protectedAction(testHandler);

      // Call the protected handler
      const result = await protectedHandler("arg1");

      // Verify the error result
      expect(result).toEqual({
        success: false,
        error: "Unauthorized access",
      });

      // Verify the handler was not called
      expect(testHandler).not.toHaveBeenCalled();
    });

    it("should return generic error when authentication fails without error message", async () => {
      const { requireAuthWithOrg } = await import("@/lib/autumn-server");
      const { cookies } = await import("next/headers");

      // Mock failed authentication without error message
      const mockResponse = {
        json: vi.fn().mockResolvedValueOnce({}),
      };
      vi.mocked(requireAuthWithOrg).mockResolvedValueOnce({
        authenticated: false,
        response: mockResponse,
      });

      // Mock cookies
      const mockGet = vi.fn().mockReturnValue(undefined);
      vi.mocked(cookies).mockResolvedValueOnce({
        get: mockGet,
      } as any);

      // Create a test handler
      const testHandler = vi.fn();
      const protectedHandler = protectedAction(testHandler);

      // Call the protected handler
      const result = await protectedHandler();

      // Verify the generic error result
      expect(result).toEqual({
        success: false,
        error: "Unauthorized",
      });

      expect(testHandler).not.toHaveBeenCalled();
    });

    it("should handle handler errors and return error result", async () => {
      const { requireAuthWithOrg } = await import("@/lib/autumn-server");
      const { cookies } = await import("next/headers");

      // Mock successful authentication
      vi.mocked(requireAuthWithOrg).mockResolvedValueOnce({
        authenticated: true,
        userId: "user123",
        organizationId: 456,
      });

      // Mock cookies
      const mockGet = vi.fn().mockReturnValue({
        value: "session-token-123",
      });
      vi.mocked(cookies).mockResolvedValueOnce({
        get: mockGet,
      } as any);

      // Create a test handler that throws
      const testError = new Error("Handler failed");
      const testHandler = vi.fn().mockRejectedValueOnce(testError);
      const protectedHandler = protectedAction(testHandler);

      // Call the protected handler
      const result = await protectedHandler();

      // Verify the error result
      expect(result).toEqual({
        success: false,
        error: "Handler failed",
      });
    });

    it("should handle non-Error thrown values", async () => {
      const { requireAuthWithOrg } = await import("@/lib/autumn-server");
      const { cookies } = await import("next/headers");

      // Mock successful authentication
      vi.mocked(requireAuthWithOrg).mockResolvedValueOnce({
        authenticated: true,
        userId: "user123",
        organizationId: 456,
      });

      // Mock cookies
      const mockGet = vi.fn().mockReturnValue({
        value: "session-token-123",
      });
      vi.mocked(cookies).mockResolvedValueOnce({
        get: mockGet,
      } as any);

      // Create a test handler that throws a string
      const testHandler = vi.fn().mockRejectedValueOnce("String error");
      const protectedHandler = protectedAction(testHandler);

      // Call the protected handler
      const result = await protectedHandler();

      // Verify the error result
      expect(result).toEqual({
        success: false,
        error: "String error",
      });
    });
  });

  describe("getActionError", () => {
    it("should return null for successful result", () => {
      const result = { success: true, data: { test: "data" } };
      expect(getActionError(result)).toBeNull();
    });

    it("should return error message for failed result", () => {
      const result = { success: false, error: "Something went wrong" };
      expect(getActionError(result)).toBe("Something went wrong");
    });
  });

  describe("getActionData", () => {
    it("should return data for successful result", () => {
      const result = { success: true, data: { test: "data" } };
      expect(getActionData(result)).toEqual({ test: "data" });
    });

    it("should return null for failed result", () => {
      const result = { success: false, error: "Something went wrong" };
      expect(getActionData(result)).toBeNull();
    });
  });
});
