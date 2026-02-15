import { db } from "@/db";
import { session, user, apiKeys, organizationMembers } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "crypto";

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
  isApiKey?: boolean;
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
export async function validateSession(token: string | null, requiredScope?: string): Promise<ValidateSessionResult> {
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

      // Session-based users have full access (no scope restrictions)
      return { valid: true, userId: userSession.userId, isApiKey: false };
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

    // Enforce scope check if a required scope was specified
    const keyScopes = Array.isArray(apiKey.scopes) ? apiKey.scopes as string[] : [];
    if (requiredScope && !keyScopes.includes(requiredScope) && !keyScopes.includes("*")) {
      return {
        valid: false,
        error: `API key does not have the required scope: ${requiredScope}`,
      };
    }

    // Update lastUsedAt (fire-and-forget, don't block the response)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(apiKeys.id, apiKey.id))
      .run();

    return { valid: true, userId: apiKey.userId, scopes: keyScopes, isApiKey: true };
  } catch (error) {
    console.error("Session validation error:", error);
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
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/autumn/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        featureId,
        requiredBalance,
      }),
    });

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
    console.error("Feature check error:", error);
    return {
      allowed: false,
      error: "Feature check failed",
    };
  }
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
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/autumn/track`, {
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
    });

    if (!response.ok) {
      return {
        success: false,
        error: "Failed to track feature usage",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Feature tracking error:", error);
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

/**
 * Middleware helper for protected API routes
 * Returns standardized error responses
 */
export async function requireAuth(request: Request): Promise<
  | { authenticated: true; userId: string }
  | { authenticated: false; response: Response }
> {
  const authHeader = request.headers.get("authorization");
  const token = extractBearerToken(authHeader);

  const validation = await validateSession(token);

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
        }
      ),
    };
  }

  return {
    authenticated: true,
    userId: validation.userId,
  };
}

/**
 * Middleware helper for protected API routes that require org context.
 * Authenticates the user AND resolves their organization membership in one call.
 * This is the application-layer RLS foundation: every protected route uses the
 * returned organizationId to scope DB queries, never trusting client-provided org IDs.
 */
export async function requireAuthWithOrg(request: Request): Promise<
  | { authenticated: true; userId: string; organizationId: number; role: string }
  | { authenticated: false; response: Response }
> {
  const authResult = await requireAuth(request);
  if (!authResult.authenticated) {
    return authResult;
  }

  const memberships = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, authResult.userId))
    .limit(1);

  if (memberships.length === 0) {
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
        }
      ),
    };
  }

  return {
    authenticated: true,
    userId: authResult.userId,
    organizationId: memberships[0].organizationId,
    role: memberships[0].role,
  };
}

/**
 * Middleware helper for admin-only API routes.
 * Requires the user to be an owner or admin of their organization.
 */
export async function requireAdmin(request: Request): Promise<
  | { authenticated: true; userId: string; organizationId: number; role: string }
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
        }
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
  requiredBalance: number = 1
): Promise<
  | { allowed: true; userId: string }
  | { allowed: false; response: Response }
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
        }
      ),
    };
  }

  return {
    allowed: true,
    userId: authResult.userId,
  };
}