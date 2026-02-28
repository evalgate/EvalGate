import postgres from "postgres";

// This will help us debug which database Vercel is actually using
const url = process.env.DATABASE_URL;

console.log("=== VERCEL DB DEBUG ===");
console.log("URL:", url ? `${url.substring(0, 40)}...` : "(NOT SET)");

if (!url) {
	console.error("❌ Missing DATABASE_URL");
	process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
	const result = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'verification'
  `;

	console.log("🔍 Verification table exists:", result.length > 0);

	const allTables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

	console.log("📋 Total tables:", allTables.length);
	console.log(
		"📋 Table names:",
		allTables.map((r) => r.table_name),
	);
} catch (err) {
	console.error("❌ Database error:", err.message);
}

await sql.end();
