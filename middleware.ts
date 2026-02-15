import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Adds security headers to all responses.
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  try {
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-XSS-Protection", "1; mode=block")
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  } catch {
    // Header setting can fail in some edge runtimes; continue without
  }
  return response
}

/**
 * CSRF protection: validate Origin header on state-changing requests.
 * Returns an error response if the Origin doesn't match the app's domain.
 */
function csrfCheck(request: NextRequest): NextResponse | null {
  const method = request.method?.toUpperCase?.() ?? "GET"
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null
  }

  // Only enforce on non-API routes (API routes use Bearer tokens, not cookies)
  if (request.nextUrl?.pathname?.startsWith?.("/api/")) {
    return null
  }

  const origin = request.headers.get("origin")
  if (!origin) {
    return null
  }

  // Use host header as fallback for Vercel Edge (nextUrl.host can be empty)
  const appHost = request.nextUrl?.host || request.headers.get("host") || request.headers.get("x-forwarded-host") || ""
  if (!appHost) return null

  try {
    const originHost = new URL(origin).host
    if (originHost !== appHost) {
      return NextResponse.json(
        { error: "CSRF validation failed", code: "CSRF_ERROR" },
        { status: 403 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid origin header", code: "CSRF_ERROR" },
      { status: 403 }
    )
  }

  return null
}

export function middleware(request: NextRequest) {
  try {
    // CSRF check for state-changing requests
    const csrfError = csrfCheck(request)
    if (csrfError) {
      return addSecurityHeaders(csrfError)
    }

    // Protected page routes: check for session token in cookies
    const protectedPaths = [
      "/dashboard",
      "/evaluations",
      "/traces",
      "/annotations",
      "/llm-judge",
      "/developer",
      "/settings",
      "/workflows",
      "/benchmarks",
      "/costs",
      "/prompts",
    ]

    const pathname = request.nextUrl?.pathname ?? ""
    const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path))

    if (isProtectedPath) {
      const sessionToken = request.cookies?.get?.("better-auth.session_token")

      if (!sessionToken) {
        const url = new URL("/auth/login", request.url)
        url.searchParams.set("redirect", pathname)
        const redirectResponse = NextResponse.redirect(url)
        return addSecurityHeaders(redirectResponse)
      }
    }

    const response = NextResponse.next()
    return addSecurityHeaders(response)
  } catch (err) {
    // Fallback: allow request through without security headers to avoid 500
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    // Match all routes except static files and _next internal paths
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}