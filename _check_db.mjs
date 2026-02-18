import { createClient } from "@libsql/client";

const url = process.env.TURSO_CONNECTION_URL;
const token = process.env.TURSO_AUTH_TOKEN;

console.log("TURSO_CONNECTION_URL:", url ? url.substring(0, 40) + "..." : "(NOT SET)");
console.log("TURSO_AUTH_TOKEN:", token ? token.substring(0, 20) + "..." : "(NOT SET)");

if (!url || !token) {
  console.error("Missing env vars, aborting.");
  process.exit(1);
}

const client = createClient({ url, authToken: token });

console.log("\nQuerying tables...");
const result = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
);
console.log(
  "Tables:",
  result.rows.map((r) => r.name),
);

if (result.rows.length === 0) {
  console.log("\nNo tables found! Creating them...");

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "email" text NOT NULL,
      "email_verified" integer DEFAULT 0 NOT NULL,
      "image" text,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email");

    CREATE TABLE IF NOT EXISTS "session" (
      "id" text PRIMARY KEY NOT NULL,
      "expires_at" integer NOT NULL,
      "token" text NOT NULL,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL,
      "ip_address" text,
      "user_agent" text,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "session_token_unique" ON "session" ("token");

    CREATE TABLE IF NOT EXISTS "account" (
      "id" text PRIMARY KEY NOT NULL,
      "account_id" text NOT NULL,
      "provider_id" text NOT NULL,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "access_token" text,
      "refresh_token" text,
      "id_token" text,
      "access_token_expires_at" integer,
      "refresh_token_expires_at" integer,
      "scope" text,
      "password" text,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "verification" (
      "id" text PRIMARY KEY NOT NULL,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expires_at" integer NOT NULL,
      "created_at" integer,
      "updated_at" integer
    );

    CREATE TABLE IF NOT EXISTS "organizations" (
      "id" integer PRIMARY KEY AUTOINCREMENT,
      "name" text NOT NULL,
      "created_at" text NOT NULL,
      "updated_at" text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "organization_members" (
      "id" integer PRIMARY KEY AUTOINCREMENT,
      "organization_id" integer NOT NULL REFERENCES "organizations"("id"),
      "user_id" text NOT NULL,
      "role" text DEFAULT 'member' NOT NULL,
      "created_at" text NOT NULL
    );
  `);

  const verify = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  );
  console.log(
    "Tables after creation:",
    verify.rows.map((r) => r.name),
  );
} else {
  console.log("Tables already exist, nothing to do.");
}

client.close();
