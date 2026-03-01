// vitest.unit.config.ts

import path from "node:path";
import { defineConfig } from "vitest/config";

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
	resolve: {
		alias: {
			"@": r("./src"),
		},
	},
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["tests/setup.unit.ts"],
		include: [
			"tests/unit/**/*.test.ts",
			"src/lib/jobs/__tests__/**/*.test.ts",
			"tests/sdk/**/*.test.ts",
		],
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/.idea/**",
			"**/.git/**",
			"**/.cache/**",
			"**/build/**",
			"**/coverage/**",
			"**/out/**",
			"**/public/**",
			"**/scripts/**",
			"**/docs/**",
			"**/drizzle/**",
			"**/examples/**",
			"**/evals/**",
			"tests/audits-disabled/**",
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			reportsDirectory: "coverage/unit",
			include: ["src/**/*.{ts,tsx}"],
			excludeAfterRemap: true,
			exclude: [
				// monorepo / non-app code
				"packages/**",
				"remotion/**",
				"visual-edits/**",
				"types/**",
				"src/lib/evaluation-templates/**",

				// standard excludes
				"**/__tests__/**",
				"**/__mocks__/**",
				"**/*.{test,spec}.{ts,tsx}",
				"**/*.bench.{ts,tsx}",
				"**/*.stories.@(js|jsx|mjs|ts|tsx)",

				// next/app boilerplate
				"src/**/index.ts",
				"src/app/**/layout.tsx",
				"src/app/**/loading.tsx",
				"src/app/**/not-found.tsx",
				"src/app/**/error.tsx",
				"src/app/**/route.ts",
				"src/middleware.ts",
				"src/instrumentation.ts",
				"src/instrumentation-client.ts",
				"src/sentry.edge.config.ts",
				"src/sentry.server.config.ts",
				"src/debug.ts",
				"src/debug-db.ts",
				"src/debug_vercel_db.mjs",
				"src/db/seeds/**",
				"			src/lib/trace-linked/**",
			],
		},
	},
});
