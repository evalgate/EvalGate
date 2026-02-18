// src/lib/actions/protected.ts
"use server";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { requireAuthWithOrg } from "@/lib/autumn-server";

/**
 * Wrapper for server actions that enforces authentication and organization scoping.
 * Returns { success: true, data: T } on success, or { success: false, error: string } on failure.
 *
 * Usage:
 *   export const myAction = protectedAction(async ({ userId, organizationId }, arg1, arg2) => {
 *     // Your action logic here - tenant isolation is guaranteed
 *     return { result: 'success' };
 *   });
 */
export function protectedAction<TArgs extends any[], TReturn>(
  action: (context: { userId: string; organizationId: number }, ...args: TArgs) => Promise<TReturn>,
) {
  return async (
    ...args: TArgs
  ): Promise<{ success: true; data: TReturn } | { success: false; error: string }> => {
    try {
      // Forward the real session token from cookies into a synthetic request
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get("better-auth.session_token")?.value;
      const mockRequest = new Request("http://localhost", {
        method: "GET",
        headers: {
          ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
        },
      }) as NextRequest;

      const authResult = await requireAuthWithOrg(mockRequest);
      if (!authResult.authenticated) {
        const errorData = await authResult.response.json();
        return { success: false, error: errorData.error || "Unauthorized" };
      }

      const { userId, organizationId } = authResult;
      const result = await action({ userId, organizationId }, ...args);

      return { success: true, data: result };
    } catch (error: any) {
      console.error("Protected action error:", error);
      return { success: false, error: error.message || "Internal server error" };
    }
  };
}

/**
 * Helper to extract error from protected action result
 */
export function getActionError<T>(
  result: { success: true; data: T } | { success: false; error: string },
): string | null {
  if (result.success) return null;
  return result.error;
}

/**
 * Helper to check if action succeeded and get data
 */
export function getActionData<T>(
  result: { success: true; data: T } | { success: false; error: string },
): T | null {
  if (result.success) return result.data;
  return null;
}
