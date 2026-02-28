import postgres from "postgres";

const url = process.env.DATABASE_URL;

console.log("DATABASE_URL:", url ? `${url.substring(0, 40)}...` : "(NOT SET)");

if (!url) {
	console.error("Missing DATABASE_URL env var, aborting.");
	process.exit(1);
}

const sql = postgres(url, { max: 1 });

console.log("\nQuerying tables...");
const result = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;
console.log(
	"Tables:",
	result.map((r) => r.table_name),
);

if (result.length === 0) {
	console.log("\nNo tables found. Run migrations: pnpm db:migrate");
} else {
	console.log(`\n${result.length} tables found.`);
}

await sql.end();
