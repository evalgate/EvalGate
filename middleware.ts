import "@/lib/polyfill-global"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Middleware: security headers only.
 * Auth is handled by each protected page/layout - Edge middleware cannot reliably
 * read session cookies after OAuth redirects (cookie timing/visibility issues).
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
