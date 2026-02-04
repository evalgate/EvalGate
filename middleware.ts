import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Check for session token in cookies
  const sessionToken = request.cookies.get("better-auth.session_token")
  
  if (!sessionToken) {
    // Redirect to login with return URL
    const url = new URL("/auth/login", request.url)
    url.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  
  return NextResponse.next()
}

export const config = {
  // Only run on protected paths
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