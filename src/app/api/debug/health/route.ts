import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Check env vars (only presence, not values)
  results.env = {
    TURSO_CONNECTION_URL: !!process.env.TURSO_CONNECTION_URL,
    TURSO_AUTH_TOKEN: !!process.env.TURSO_AUTH_TOKEN,
    BETTER_AUTH_SECRET: !!process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_BASE_URL: process.env.BETTER_AUTH_BASE_URL || "(not set)",
    AUTUMN_SECRET_KEY: !!process.env.AUTUMN_SECRET_KEY,
    GITHUB_CLIENT_ID: !!process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: !!process.env.GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  };

  // 2. Test DB connection
  try {
    const { db } = await import("@/db");
    // Run a simple query to test the connection
    const testResult = await db.run(
      // @ts-expect-error raw SQL for diagnostic
      { sql: "SELECT 1 as ok", args: [] }
    );
    results.db = { status: "connected", test: testResult };
  } catch (e: unknown) {
    results.db = {
      status: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  // 3. Test auth initialization
  try {
    const { auth } = await import("@/lib/auth");
    results.auth = {
      status: "initialized",
      baseURL: auth.options?.baseURL || "(unknown)",
    };
  } catch (e: unknown) {
    results.auth = {
      status: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json(results, { status: 200 });
}
