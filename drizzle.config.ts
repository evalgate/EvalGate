import type { Config } from "drizzle-kit";
import { defineConfig } from "drizzle-kit";

// Load .env.local for drizzle-kit commands (generate, studio). For migrations, use pnpm db:migrate.
const url = process.env.TURSO_CONNECTION_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url && process.env.NODE_ENV !== "test") {
  console.error(
    "TURSO_CONNECTION_URL is required. Run with: npx dotenv-cli -e .env.local -- pnpm drizzle-kit <command>",
  );
  console.error("For applying migrations, use: pnpm db:migrate");
  process.exit(1);
}

const dbConfig: Config = defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: url ?? "file:./test.db",
    authToken: authToken ?? "",
  },
});

export default dbConfig;
