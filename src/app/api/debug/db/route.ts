import { createClient } from "@libsql/client";
import { NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";

export async function GET() {
  const url = process.env.TURSO_CONNECTION_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  if (!url || !token) {
    return internalError("Missing Turso credentials");
  }

  const client = createClient({ url, authToken: token });

  try {
    // Check if verification table exists
    const verificationCheck = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='verification'
    `);

    // List all tables
    const allTables = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);

    return NextResponse.json({
      database: `${url.substring(0, 40)}...`,
      verificationExists: verificationCheck.rows.length > 0,
      totalTables: allTables.rows.length,
      tables: allTables.rows.map((r) => r.name),
    });
  } catch (err: unknown) {
    return internalError(err instanceof Error ? err.message : "Database connection failed");
  } finally {
    client.close();
  }
}
