import { sql } from "drizzle-orm";
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

  // 2. Test DB connection + list tables
  try {
    const { db } = await import("@/db");
    const rows = await db.all(sql`SELECT 1 as ok`);
    const tables = await db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
    );
    results.db = { status: "connected", rows, tables };
  } catch (e: unknown) {
    results.db = {
      status: "error",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5) : undefined,
    };
  }

  // 3. Test auth initialization
  try {
    const { auth } = await import("@/lib/auth");
    results.auth = { status: "initialized", hasApi: !!auth.api };
  } catch (e: unknown) {
    results.auth = {
      status: "error",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5) : undefined,
    };
  }

  // 4. Test auth.api.getSession (with empty headers — should return null, not crash)
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth.api.getSession({
      headers: new Headers(),
    });
    results.sessionTest = { status: "ok", session: session || null };
  } catch (e: unknown) {
    results.sessionTest = {
      status: "error",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5) : undefined,
    };
  }

  return NextResponse.json(results, { status: 200 });
}
