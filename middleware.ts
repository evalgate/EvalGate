import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Minimal pass-through middleware.
 * Auth and security headers disabled to isolate MIDDLEWARE_INVOCATION_FAILED.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  // TEMP: Matcher that never matches = middleware disabled. If site loads, middleware was the cause.
  matcher: ["/__middleware-disabled-unused-path"],
}
