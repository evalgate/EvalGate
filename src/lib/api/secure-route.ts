/**
 * Centralized API route wrapper — the single entry point for authenticated handlers.
 *
 * Every API route should be wrapped with `secureRoute()` (or listed in the
 * public route allowlist tested by route-auth-audit.test.ts).
 *
 * Responsibilities:
 *  1. Authentication (session or API-key)
 *  2. Organization resolution
 *  3. Rate limiting (always-on for anonymous, configurable tier for authed)
 *  4. Standard error envelope (see errors.ts)
 *  5. Structured logging of failures
 */

import type { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { type ApiErrorCode, apiError, internalError, zodValidationError } from "@/lib/api/errors";
import {
  extractOrGenerateRequestId,
  getRequestContext,
  runWithRequestIdAsync,
  setRequestContext,
} from "@/lib/api/request-id";
import { withRateLimit } from "@/lib/api-rate-limit";
import { requireAuth, requireAuthWithOrg } from "@/lib/autumn-server";
import { logger } from "@/lib/logger";

const REQUEST_ID_HEADER = "x-request-id";

// ── Types ──

export type RateLimitTier = "anonymous" | "free" | "pro" | "enterprise" | "mcp";

export type Role = "viewer" | "member" | "admin" | "owner";
export type AuthType = "session" | "apiKey" | "anonymous";

export interface AuthContext {
  userId: string;
  organizationId: number;
  role: Role;
  scopes: string[];
  authType: AuthType;
  rateLimitTier?: RateLimitTier;
  /** Present when authenticated via API key; used for usage tracking. */
  apiKeyId?: number;
}

export interface AuthOnlyContext {
  userId: string;
  scopes: string[];
  authType: Exclude<AuthType, "anonymous">;
  rateLimitTier?: Exclude<RateLimitTier, "anonymous">;
}

/** Explicit context for anonymous or authed handlers — never return empty {} */
export type unknownAuthContext =
  | { authType: "anonymous" }
  | {
      authType: "session" | "apiKey";
      userId: string;
      organizationId?: number;
      role?: Role;
      scopes?: string[];
      rateLimitTier?: Exclude<RateLimitTier, "anonymous">;
    };

export type SecureRouteOptions = {
  /** Require org membership (default: true). Set false for user-only auth. */
  requireOrg?: boolean;
  /** Require authentication at all (default: true). */
  requireAuth?: boolean;
  /** Allow unauthenticated access — used for public endpoints. */
  allowAnonymous?: boolean;
  /** Rate-limit tier. Applied for anonymous; authed users get their plan tier. */
  rateLimit?: RateLimitTier;
  /** Scopes the caller must hold. Checked after auth resolves. */
  requiredScopes?: string[];
  /** Minimum organization role required (checked via ROLE_RANK hierarchy). */
  minRole?: Role;
};

// ── Role ranking & helpers ──

export const ROLE_RANK: Record<Role, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

export function normalizeRole(role: string): Role {
  const r = role.toLowerCase();
  if (r === "owner") return "owner";
  if (r === "admin") return "admin";
  if (r === "member") return "member";
  return "viewer";
}

export function hasMinRole(role: Role, minRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

export function hasScopes(granted: string[], required: string[]): boolean {
  const set = new Set(granted);
  return required.every((s) => set.has(s));
}

export function deriveRateLimitTier(
  authType: AuthType,
  role?: Role,
): Exclude<RateLimitTier, "anonymous"> {
  if (authType === "apiKey") return "mcp";
  if (role === "owner" || role === "admin") return "pro";
  return "free";
}

// ── Overloads so callers get the correct context type ──

/** Authenticated + org-scoped handler (default) */
export function secureRoute(
  handler: (req: NextRequest, ctx: any, params: Record<string, string>) => Promise<NextResponse>,
  options?: SecureRouteOptions & { requireOrg?: true; allowAnonymous?: false | undefined },
): (req: NextRequest, props: { params: Promise<Record<string, string>> }) => Promise<NextResponse>;

/** Authenticated but user-only (no org) */
export function secureRoute(
  handler: (
    req: NextRequest,
    ctx: AuthOnlyContext,
    params: Record<string, string>,
  ) => Promise<NextResponse>,
  options: SecureRouteOptions & { requireOrg: false; allowAnonymous?: false | undefined },
): (req: NextRequest, props: { params: Promise<Record<string, string>> }) => Promise<NextResponse>;

/** Anonymous / public handler — ctx always has authType ('anonymous' or full auth) */
export function secureRoute(
  handler: (
    req: NextRequest,
    ctx: unknownAuthContext,
    params: Record<string, string>,
  ) => Promise<NextResponse>,
  options: SecureRouteOptions & { allowAnonymous: true },
): (req: NextRequest, props: { params: Promise<Record<string, string>> }) => Promise<NextResponse>;

// ── Implementation ──

export function secureRoute(
  handler: (req: NextRequest, ctx: any, params: Record<string, string>) => Promise<NextResponse>,
  options: SecureRouteOptions = {},
): (req: NextRequest, props: { params: Promise<Record<string, string>> }) => Promise<NextResponse> {
  const {
    requireOrg: needsOrg = true,
    requireAuth: needsAuth = true,
    allowAnonymous = false,
    rateLimit: tier,
  } = options;

  return async (req: NextRequest, props: { params: Promise<Record<string, string>> }) => {
    const requestId = extractOrGenerateRequestId(req as unknown as Request);
    const resolvedParams = await props.params;

    const addRequestIdHeader = (res: NextResponse): NextResponse => {
      res.headers.set(REQUEST_ID_HEADER, requestId);
      return res;
    };

    // ── Anonymous path: check first, before auth; always apply rate limit ──
    if (allowAnonymous) {
      const hasAuth = !!req.headers.get("authorization");
      if (!hasAuth) {
        return runWithRequestIdAsync(requestId, async () => {
          logger.info("Request started", {
            requestId,
            route: req.nextUrl.pathname,
            method: req.method,
          });
          const start = performance.now();
          const res = await withRateLimit(
            req,
            async () => handler(req, { authType: "anonymous" }, resolvedParams),
            { customTier: tier ?? "anonymous" },
          );
          const durationMs = Math.round(performance.now() - start);
          logger.info("Request completed", {
            requestId,
            route: req.nextUrl.pathname,
            method: req.method,
            durationMs,
            statusCode: (res as Response).status,
          });
          return addRequestIdHeader(res);
        });
      }
      // Auth header exists — fall through to authed path
    }

    // Wrap the core logic so rate limiting can wrap it too
    const coreHandler = async (request: NextRequest): Promise<NextResponse> => {
      try {
        // ── Auth path (required auth, or optional auth when allowAnonymous + header present) ──
        const hasAuthHeader = !!request.headers.get("authorization");
        if (needsAuth || (allowAnonymous && hasAuthHeader)) {
          if (needsOrg) {
            const authResult = await requireAuthWithOrg(request as unknown as Request);
            if (!authResult.authenticated) {
              // Parse the error from the auth response
              try {
                const errBody = await authResult.response.json();
                const code = (errBody.code ?? "UNAUTHORIZED") as ApiErrorCode;
                return apiError(code, errBody.error ?? "Unauthorized");
              } catch {
                return apiError("UNAUTHORIZED", "Unauthorized");
              }
            }
            const ctx: AuthContext = {
              userId: authResult.userId,
              organizationId: authResult.organizationId,
              role: authResult.role,
              scopes: authResult.scopes,
              authType: authResult.authType,
              rateLimitTier: deriveRateLimitTier(authResult.authType, authResult.role),
              apiKeyId: authResult.apiKeyId,
            };
            setRequestContext({ userId: ctx.userId, organizationId: ctx.organizationId });

            // ── Role gate ──
            if (options.minRole && !hasMinRole(ctx.role, options.minRole)) {
              return apiError("FORBIDDEN", `Requires at least ${options.minRole} role`);
            }
            // ── Scope gate ──
            if (options.requiredScopes?.length && !hasScopes(ctx.scopes, options.requiredScopes)) {
              return apiError("FORBIDDEN", "Insufficient scope");
            }

            if (tier) {
              return await handler(request, ctx, resolvedParams);
            }

            return await withRateLimit(request, async () => handler(request, ctx, resolvedParams), {
              customTier: ctx.rateLimitTier ?? "free",
            });
          } else {
            const authResult = await requireAuth(request as unknown as Request);
            if (!authResult.authenticated) {
              return apiError("UNAUTHORIZED", "Unauthorized");
            }
            const ctx: AuthOnlyContext = {
              userId: authResult.userId,
              scopes: authResult.scopes,
              authType: authResult.authType,
              rateLimitTier: deriveRateLimitTier(authResult.authType),
            };
            setRequestContext({ userId: ctx.userId });

            // ── Scope gate (no role check for user-only routes) ──
            if (options.requiredScopes?.length && !hasScopes(ctx.scopes, options.requiredScopes)) {
              return apiError("FORBIDDEN", "Insufficient scope");
            }

            if (tier) {
              return await handler(request, ctx, resolvedParams);
            }

            return await withRateLimit(request, async () => handler(request, ctx, resolvedParams), {
              customTier: ctx.rateLimitTier ?? "free",
            });
          }
        }

        // fallback: no auth required (requireAuth: false, no allowAnonymous) — use anonymous ctx for consistency
        return await handler(request, { authType: "anonymous" }, resolvedParams);
      } catch (err) {
        if (err instanceof ZodError) {
          return zodValidationError(err);
        }
        const message = err instanceof Error ? err.message : "Internal server error";
        logger.error("Unhandled route error", { error: message, path: request.nextUrl.pathname });
        return internalError(message);
      }
    };

    // ── Rate limiting wrapper (run in request-id context, add header to response, log duration) ──
    const runAndAddHeader = async (): Promise<NextResponse> => {
      logger.info("Request started", {
        requestId,
        route: req.nextUrl.pathname,
        method: req.method,
      });
      const start = performance.now();
      const res = tier
        ? await withRateLimit(req, coreHandler, { customTier: tier })
        : await coreHandler(req);
      const durationMs = Math.round(performance.now() - start);
      const reqCtx = getRequestContext();
      logger.info("Request completed", {
        requestId,
        route: req.nextUrl.pathname,
        method: req.method,
        userId: reqCtx?.userId ?? null,
        organizationId: reqCtx?.organizationId ?? null,
        durationMs,
        statusCode: (res as Response).status,
      });
      return addRequestIdHeader(res);
    };
    return runWithRequestIdAsync(requestId, runAndAddHeader);
  };
}
