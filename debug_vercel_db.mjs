import { createClient } from "@libsql/client";

// This will help us debug which database Vercel is actually using
const url = process.env.TURSO_CONNECTION_URL;
const token = process.env.TURSO_AUTH_TOKEN;

console.log("=== VERCEL DB DEBUG ===");
console.log("URL:", url ? url.substring(0, 40) + "..." : "(NOT SET)");
console.log("TOKEN:", token ? token.substring(0, 20) + "..." : "(NOT SET)");

if (!url || !token) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const client = createClient({ url, authToken: token });

// Check if verification table exists
try {
  const result = await client.execute(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='verification'
  `);

  console.log("🔍 Verification table exists:", result.rows.length > 0);

  // List all tables
  const allTables = await client.execute(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `);

  console.log("📋 Total tables:", allTables.rows.length);
  console.log(
    "📋 Table names:",
    allTables.rows.map((r) => r.name),
  );
} catch (err) {
  console.error("❌ Database error:", err.message);
}

client.close();
