# ADR-004: Per-Route Auth via secureRoute() over Edge Middleware

**Status:** Accepted
**Date:** 2026-02-28
**Decision makers:** Paul Cavallo

## Context

Authentication and authorization can be enforced in Next.js either globally via Edge middleware (`middleware.ts`) or per-route within individual API handlers and server components.

Edge middleware runs before the request reaches the route handler, making it an attractive place for auth checks. However, we encountered a critical issue: after OAuth redirects (e.g., Google, GitHub SSO), session cookies set during the callback are not reliably available in Edge middleware on the immediately following request. This is due to cookie timing — the `Set-Cookie` header from the OAuth callback response and the subsequent redirect can race, leaving middleware without the session cookie.

This caused intermittent 401 errors after login, particularly on Vercel's Edge network where middleware runs in a different execution context than the route handler.

## Decision

We enforce authentication per-route using the `secureRoute()` wrapper from `@/lib/api/secure-route`. Every authenticated API route and server action calls `secureRoute()`, which handles session validation (via cookies) or API key validation (via `Authorization` header), organization resolution, rate limiting, and structured error responses.

Public routes that require rate limiting use `withRateLimit()` from `@/lib/api-rate-limit` instead.

## Consequences

**Easier:**
- No cookie timing issues after OAuth redirects — by the time the route handler runs, cookies are fully available.
- Each route explicitly declares its auth requirements, making security auditing straightforward (grep for `secureRoute`).
- Rate limiting, org resolution, and error handling are co-located with auth in a single wrapper.
- Testing is simpler — mock `secureRoute` in tests rather than simulating Edge middleware behavior.

**More difficult:**
- Every new authenticated route must remember to wrap with `secureRoute()`. A missing wrapper means an unprotected endpoint.
- There is no centralized "deny by default" — public routes are public unless explicitly protected.
- Slightly more boilerplate per route compared to a single middleware file that protects all `/api/*` routes.
