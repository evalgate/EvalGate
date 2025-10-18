import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getRateLimitTier } from "./rate-limit";
import * as Sentry from "@sentry/nextjs";

export async function withRateLimit(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>,
  options?: {
    customIdentifier?: string;
    customTier?: "free" | "pro" | "enterprise" | "anonymous";
  }
) {
  try {
    // Get identifier (IP address or custom identifier)
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') ||
               '127.0.0.1';
    const identifier = options?.customIdentifier || ip || "anonymous";

    // Determine rate limit tier
    const tier = options?.customTier || "anonymous";

    // Check rate limit
    const { success, headers } = await checkRateLimit(identifier, tier);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { 
          status: 429,
          headers: headers as HeadersInit
        }
      );
    }

    // Call the handler
    const response = await handler(request);

    // Add rate limit headers to response
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper to get user's plan from request
export async function getUserPlanFromRequest(request: NextRequest): Promise<string | undefined> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return undefined;
    }

    // This is a simplified version - you might need to decode JWT or query database
    // For now, return undefined to use default tier
    return undefined;
  } catch (error) {
    Sentry.captureException(error);
    return undefined;
  }
}