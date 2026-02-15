import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Adds security headers to all responses.
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  return response
}

/**
 * CSRF protection: validate Origin header on state-changing requests.
 * Returns an error response if the Origin doesn't match the app's domain.
 */
function csrfCheck(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase()
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null
  }

  // Only enforce on non-API routes (API routes use Bearer tokens, not cookies)
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return null
  }

  const origin = request.headers.get("origin")
  if (!origin) {
    return null
  }

  const appHost = request.nextUrl.host
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

  const isProtectedPath = protectedPaths.some(
    (path) => request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedPath) {
    const sessionToken = request.cookies.get("better-auth.session_token")

    if (!sessionToken) {
      const url = new URL("/auth/login", request.url)
      url.searchParams.set("redirect", request.nextUrl.pathname)
      const redirectResponse = NextResponse.redirect(url)
      return addSecurityHeaders(redirectResponse)
    }
  }

  const response = NextResponse.next()
  return addSecurityHeaders(response)
}

export const config = {
  matcher: [
    // Match all routes except static files and _next internal paths
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}