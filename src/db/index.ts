import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

// Validate environment variables at startup
if (!process.env.TURSO_CONNECTION_URL) {
  console.error("TURSO_CONNECTION_URL environment variable is not set");
}
if (!process.env.TURSO_AUTH_TOKEN) {
  console.error("TURSO_AUTH_TOKEN environment variable is not set");
}

const client = createClient({
  url: process.env.TURSO_CONNECTION_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
