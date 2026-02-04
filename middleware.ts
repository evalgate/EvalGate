import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Minimal middleware - just pass through
  return NextResponse.next()
}

export const config = {
  // Only run on specific paths, not the homepage
  matcher: [
    "/dashboard/:path*",
    "/evaluations/:path*",
    "/traces/:path*",
    "/annotations/:path*",
    "/llm-judge/:path*",
    "/developer/:path*",
    "/settings/:path*",
  ],
}