// src/lib/actions/protected.ts
"use server";

import { cookies } from "next/headers";
import { requireAuthWithOrg } from "@/lib/autumn-server";
import { logger } from "@/lib/logger";

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
export function protectedAction<TArgs extends unknown[], TReturn>(
	action: (
		context: { userId: string; organizationId: number },
		...args: TArgs
	) => Promise<TReturn>,
) {
	return async (
		...args: TArgs
	): Promise<
		{ success: true; data: TReturn } | { success: false; error: string }
	> => {
		try {
			// Forward the real session token from cookies into a synthetic request
			const cookieStore = await cookies();
			const sessionToken = cookieStore.get("better-auth.session_token")?.value;

			// Create a proper Request with the required properties
			const mockRequest = new Request("http://localhost", {
				method: "GET",
				headers: new Headers({
					...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
				}),
			});

			const authResult = await requireAuthWithOrg(mockRequest);
			if (!authResult.authenticated) {
				const errorData = await authResult.response.json();
				return { success: false, error: errorData.error || "Unauthorized" };
			}

			const { userId, organizationId } = authResult;
			const result = await action({ userId, organizationId }, ...args);

			return { success: true, data: result };
		} catch (error: unknown) {
			logger.error("Protected action error", error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return { success: false, error: errorMessage || "Internal server error" };
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
