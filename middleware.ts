import "@/lib/polyfill-global"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PROTECTED_PATHS = [
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

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Protected paths: redirect to login if no session
  const pathname = request.nextUrl.pathname
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))

  if (isProtected) {
    const session = request.cookies.get("better-auth.session_token")
    if (!session?.value) {
      const loginUrl = new URL("/auth/login", request.nextUrl.origin)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/evaluations/:path*",
    "/traces/:path*",
    "/annotations/:path*",
    "/llm-judge/:path*",
    "/developer/:path*",
    "/settings/:path*",
    "/workflows/:path*",
    "/benchmarks/:path*",
    "/costs/:path*",
    "/prompts/:path*",
  ],
}
