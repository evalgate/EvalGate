import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { NextResponse } from "next/server";
import { db } from "@/db";
import {
	apiKeys,
	organizationMembers,
	organizations,
	session,
} from "@/db/schema";
import { quotaExceeded } from "@/lib/api/errors";
import {
	type AuthType,
	normalizeRole,
	type Role,
} from "@/lib/api/secure-route";
import { scopesForRole } from "@/lib/auth/scopes";
import { logger } from "@/lib/logger";

/**
 * Server-side Autumn feature checking and tracking
 * This runs on the server and cannot be bypassed by client-side manipulation
 */

interface CheckFeatureParams {
	userId: string;
	featureId: string;
	requiredBalance?: number;
}

interface TrackFeatureParams {
	userId: string;
	featureId: string;
	value: number;
	idempotencyKey?: string;
}

interface ValidateSessionResult {
	valid: boolean;
	userId?: string;
	error?: string;
	scopes?: string[];
	authType?: AuthType;
	/** For API key auth, the org the key is scoped to. */
	apiKeyOrgId?: number;
	/** For API key auth, the key ID for usage tracking. */
	apiKeyId?: number;
}

/**
 * Validate a bearer token against both session tokens AND API keys.
 * Checks session table first (fast path for browser users),
 * then falls back to the apiKeys table for SDK/programmatic access.
 *
 * If `requiredScope` is provided and the token is an API key,
 * the key's scopes are checked and a 403 is returned if the scope is missing.
 * Session-based users (browser) are not subject to scope checks.
 */
export async function validateSession(
	token: string | null,
	requiredScope?: string,
): Promise<ValidateSessionResult> {
	if (!token) {
		return { valid: false, error: "No authentication token provided" };
	}

	try {
		// ── Path 1: Check better-auth session table ──
		const sessions = await db
			.select()
			.from(session)
			.where(eq(session.token, token))
			.limit(1);

		if (sessions.length > 0) {
			const userSession = sessions[0];
			const now = new Date();
			const expiresAt = new Date(userSession.expiresAt);

			if (expiresAt < now) {
				return { valid: false, error: "Session expired" };
			}

			// Session-based users get scopes derived from their org role later
			return { valid: true, userId: userSession.userId, authType: "session" };
		}

		// ── Path 2: Check API keys table (for SDK / programmatic access) ──
		const keyHash = crypto.createHash("sha256").update(token).digest("hex");

		const keys = await db
			.select()
			.from(apiKeys)
			.where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
			.limit(1);

		if (keys.length === 0) {
			return { valid: false, error: "Invalid token or API key" };
		}

		const apiKey = keys[0];

		// Check expiration
		if (apiKey.expiresAt) {
			const expiresAt = new Date(apiKey.expiresAt);
			if (expiresAt < new Date()) {
				return { valid: false, error: "API key expired" };
			}
		}

		// Reject wildcard scope at runtime (legacy keys)
		const keyScopes = Array.isArray(apiKey.scopes)
			? (apiKey.scopes as string[])
			: [];
		if (keyScopes.includes("*")) {
			return { valid: false, error: "Wildcard scope '*' is not allowed" };
		}

		// Enforce scope check if a required scope was specified
		if (requiredScope && !keyScopes.includes(requiredScope)) {
			return {
				valid: false,
				error: `API key does not have the required scope: ${requiredScope}`,
			};
		}

		// Update lastUsedAt (fire-and-forget, don't block the response)
		db.update(apiKeys)
			.set({ lastUsedAt: new Date() })
			.where(eq(apiKeys.id, apiKey.id))
			.run();

		return {
			valid: true,
			userId: apiKey.userId,
			scopes: keyScopes,
			authType: "apiKey",
			apiKeyOrgId: apiKey.organizationId,
			apiKeyId: apiKey.id,
		};
	} catch (error) {
		logger.error("Session validation error", error);
		return { valid: false, error: "Session validation failed" };
	}
}

/**
 * Check if user has allowance for a feature
 * Calls Autumn API to verify quota server-side
 */
export async function checkFeature(params: CheckFeatureParams): Promise<{
	allowed: boolean;
	remaining?: number;
	error?: string;
}> {
	const { userId, featureId, requiredBalance = 1 } = params;

	try {
		// Call Autumn API to check feature allowance
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "https://evalgate.com" : "http://localhost:3000")}/api/autumn/check`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					userId,
					featureId,
					requiredBalance,
				}),
			},
		);

		if (!response.ok) {
			return {
				allowed: false,
				error: "Failed to check feature allowance",
			};
		}

		const data = await response.json();
		return {
			allowed: data.allowed || false,
			remaining: data.remaining,
		};
	} catch (error) {
		logger.error("Feature check error", error);
		return {
			allowed: false,
			error: "Feature check failed",
		};
	}
}

/**
 * Guard a route behind a feature entitlement.
 * Returns a 403 NextResponse if the feature quota is exhausted, or `null` if allowed.
 *
 * Usage inside a secureRoute handler:
 *   const blocked = await guardFeature(ctx.userId, "traces", "Traces limit reached.");
 *   if (blocked) return blocked;
 */
export async function guardFeature(
	userId: string,
	featureId: string,
	limitMessage: string,
): Promise<NextResponse | null> {
	const result = await checkFeature({ userId, featureId, requiredBalance: 1 });
	if (!result.allowed) {
		return quotaExceeded(limitMessage, {
			featureId,
			remaining: result.remaining ?? 0,
		});
	}
	return null;
}

/**
 * Track feature usage
 * Records usage server-side to prevent manipulation
 */
export async function trackFeature(params: TrackFeatureParams): Promise<{
	success: boolean;
	error?: string;
}> {
	const { userId, featureId, value, idempotencyKey } = params;

	try {
		// Call Autumn API to track usage
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "https://evalgate.com" : "http://localhost:3000")}/api/autumn/track`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					userId,
					featureId,
					value,
					idempotencyKey,
				}),
			},
		);

		if (!response.ok) {
			return {
				success: false,
				error: "Failed to track feature usage",
			};
		}

		return { success: true };
	} catch (error) {
		logger.error("Feature tracking error", error);
		return {
			success: false,
			error: "Feature tracking failed",
		};
	}
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
	if (!authHeader) return null;

	const match = authHeader.match(/^Bearer\s+(.+)$/i);
	return match ? match[1] : null;
}

export function extractSessionTokenFromCookie(
	cookieHeader: string | null,
): string | null {
	if (!cookieHeader) return null;
	const match = cookieHeader.match(
		/(?:^|;\s*)better-auth\.session_token=([^;]+)/,
	);
	if (!match?.[1]) return null;
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return match[1];
	}
}

/**
 * Middleware helper for protected API routes
 * Returns standardized error responses
 */
export async function requireAuth(request: Request): Promise<
	| {
			authenticated: true;
			userId: string;
			scopes: string[];
			authType: Exclude<AuthType, "anonymous">;
			/** Present only for API-key auth — the org the key belongs to. */
			apiKeyOrgId?: number;
			/** Present only for API-key auth — for usage tracking. */
			apiKeyId?: number;
	  }
	| { authenticated: false; response: Response }
> {
	const authHeader = request.headers.get("authorization");
	const bearerToken = extractBearerToken(authHeader);
	const cookieToken = extractSessionTokenFromCookie(
		request.headers.get("cookie"),
	);
	const primaryToken = bearerToken ?? cookieToken;
	let validation = await validateSession(primaryToken);

	if (
		!validation.valid &&
		bearerToken &&
		cookieToken &&
		bearerToken !== cookieToken
	) {
		validation = await validateSession(cookieToken);
	}

	if (!validation.valid || !validation.userId) {
		return {
			authenticated: false,
			response: new Response(
				JSON.stringify({
					error: validation.error || "Unauthorized",
					code: "UNAUTHORIZED",
				}),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				},
			),
		};
	}

	return {
		authenticated: true,
		userId: validation.userId,
		scopes: validation.scopes ?? [],
		authType:
			(validation.authType as Exclude<AuthType, "anonymous">) ?? "session",
		apiKeyOrgId: validation.apiKeyOrgId,
		apiKeyId: validation.apiKeyId,
	};
}

/**
 * Middleware helper for protected API routes that require org context.
 * Authenticates the user AND resolves their organization membership in one call.
 * This is the application-layer RLS foundation: every protected route uses the
 * returned organizationId to scope DB queries, never trusting client-provided org IDs.
 */
export async function requireAuthWithOrg(request: Request): Promise<
	| {
			authenticated: true;
			userId: string;
			organizationId: number;
			role: Role;
			scopes: string[];
			authType: Exclude<AuthType, "anonymous">;
			apiKeyId?: number;
	  }
	| { authenticated: false; response: Response }
> {
	const authResult = await requireAuth(request);
	if (!authResult.authenticated) {
		return authResult;
	}

	// ── API-key path: org comes from the key itself ──
	if (authResult.authType === "apiKey" && authResult.apiKeyOrgId) {
		return {
			authenticated: true,
			userId: authResult.userId,
			organizationId: authResult.apiKeyOrgId,
			role: "member" as Role, // API keys don't carry a role; treat as member
			scopes: authResult.scopes,
			authType: "apiKey",
			apiKeyId: authResult.apiKeyId,
		};
	}

	// ── Session path: look up org membership ──
	// Check for active_org cookie to allow multi-org users to pick which org
	const cookieHeader = request.headers.get("cookie") ?? "";
	const activeOrgMatch = cookieHeader.match(/(?:^|;\s*)active_org=(\d+)/);
	const preferredOrgId = activeOrgMatch
		? parseInt(activeOrgMatch[1], 10)
		: null;

	// If the user set a preferred org, verify org exists and user is still a member
	let membership: { organizationId: number; role: string } | undefined;

	if (preferredOrgId) {
		const [preferred] = await db
			.select({
				organizationId: organizationMembers.organizationId,
				role: organizationMembers.role,
			})
			.from(organizationMembers)
			.innerJoin(
				organizations,
				eq(organizationMembers.organizationId, organizations.id),
			)
			.where(
				and(
					eq(organizationMembers.userId, authResult.userId),
					eq(organizationMembers.organizationId, preferredOrgId),
				),
			)
			.limit(1);
		membership = preferred;
	}

	// Fall back to first valid membership if preferred org invalid (deleted, user removed, etc.)
	if (!membership) {
		const [first] = await db
			.select({
				organizationId: organizationMembers.organizationId,
				role: organizationMembers.role,
			})
			.from(organizationMembers)
			.innerJoin(
				organizations,
				eq(organizationMembers.organizationId, organizations.id),
			)
			.where(eq(organizationMembers.userId, authResult.userId))
			.limit(1);
		membership = first;
	}

	if (!membership) {
		return {
			authenticated: false,
			response: new Response(
				JSON.stringify({
					error: "No organization membership found for this user",
					code: "NO_ORG_MEMBERSHIP",
				}),
				{
					status: 403,
					headers: { "Content-Type": "application/json" },
				},
			),
		};
	}

	const role = normalizeRole(membership.role);

	return {
		authenticated: true,
		userId: authResult.userId,
		organizationId: membership.organizationId,
		role,
		scopes: scopesForRole(role),
		authType: "session",
	};
}

/**
 * Middleware helper for admin-only API routes.
 * Requires the user to be an owner or admin of their organization.
 */
export async function requireAdmin(request: Request): Promise<
	| {
			authenticated: true;
			userId: string;
			organizationId: number;
			role: Role;
			scopes: string[];
			authType: Exclude<AuthType, "anonymous">;
	  }
	| { authenticated: false; response: Response }
> {
	const result = await requireAuthWithOrg(request);
	if (!result.authenticated) {
		return result;
	}

	if (result.role !== "owner" && result.role !== "admin") {
		return {
			authenticated: false,
			response: new Response(
				JSON.stringify({
					error: "Admin access required",
					code: "FORBIDDEN",
				}),
				{
					status: 403,
					headers: { "Content-Type": "application/json" },
				},
			),
		};
	}

	return result;
}

/**
 * Middleware helper for feature-gated API routes
 * Checks both auth and feature allowance
 */
export async function requireFeature(
	request: Request,
	featureId: string,
	requiredBalance: number = 1,
): Promise<
	{ allowed: true; userId: string } | { allowed: false; response: Response }
> {
	// First check auth
	const authResult = await requireAuth(request);
	if (!authResult.authenticated) {
		return { allowed: false, response: authResult.response };
	}

	// Then check feature allowance
	const featureCheck = await checkFeature({
		userId: authResult.userId,
		featureId,
		requiredBalance,
	});

	if (!featureCheck.allowed) {
		return {
			allowed: false,
			response: new Response(
				JSON.stringify({
					error: `${featureId.charAt(0).toUpperCase() + featureId.slice(1)} limit reached. Upgrade your plan to increase quota.`,
					code: "QUOTA_EXCEEDED",
					featureId,
					remaining: featureCheck.remaining || 0,
				}),
				{
					status: 402, // Payment Required
					headers: { "Content-Type": "application/json" },
				},
			),
		};
	}

	return {
		allowed: true,
		userId: authResult.userId,
	};
}
