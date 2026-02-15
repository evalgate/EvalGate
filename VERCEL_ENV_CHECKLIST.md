# Vercel Environment Variables Checklist

Ensure these are set in your Vercel project (**Settings → Environment Variables**):

## Required for Auth (better-auth)

| Variable | Description | Example |
|----------|-------------|---------|
| `BETTER_AUTH_SECRET` | **Required.** Random secret for signing sessions. Generate with `openssl rand -base64 32` | `a1b2c3...` |
| `BETTER_AUTH_BASE_URL` | Production URL of your app | `https://v0-ai-evaluation-platform-nu.vercel.app` |

## Required for Database

| Variable | Description |
|----------|-------------|
| `TURSO_CONNECTION_URL` | LibSQL/Turso connection URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |

## Optional but Recommended

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SITE_URL` | Same as BETTER_AUTH_BASE_URL (used as fallback) |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error tracking |
| `UPSTASH_REDIS_REST_URL` | For rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | For rate limiting |

## Quick Check

1. **BETTER_AUTH_SECRET** – If missing, auth will fail. Must be set for Production.
2. **BETTER_AUTH_BASE_URL** – Must match your Vercel deployment URL exactly (no trailing slash).
3. **Database** – TURSO_* vars must be valid for the app to start.

## Middleware Note

The middleware only checks for the `better-auth.session_token` cookie. It does **not** call better-auth. Auth env vars are needed for `/api/auth/*` routes and the login page, not for the middleware itself. If you see `MIDDLEWARE_INVOCATION_FAILED`, the issue is in the middleware code, not auth config.
