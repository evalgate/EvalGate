#!/usr/bin/env npx tsx
/**
 * Run platform-ci.yml locally.
 * Mirrors the GitHub Actions workflow for local pre-push validation.
 *
 * Usage: pnpm run ci:local
 *        pnpm run ci:local -- --skip-e2e   # Skip build + Playwright (faster)
 *        pnpm run ci:local -- --skip-audits # Skip audits (faster)
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKIP_E2E = process.argv.includes("--skip-e2e");
const SKIP_AUDITS = process.argv.includes("--skip-audits");
const SKIP_REGRESSION = process.argv.includes("--skip-regression");
const SKIP_DB = process.argv.includes("--skip-db"); // skip DB confidence + DB coverage + regression gate (use when no local PostgreSQL)

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function run(cmd: string, env?: Record<string, string>) {
	const fullEnv = { ...process.env, NODE_ENV: "test", ...env };
	console.log(`\n▶ ${cmd}\n`);
	execSync(cmd, {
		cwd: root,
		stdio: "inherit",
		env: fullEnv,
	});
}

function step(name: string, fn: () => void) {
	console.log(`\n${"─".repeat(60)}`);
	console.log(`  ${name}`);
	console.log(`${"─".repeat(60)}`);
	try {
		fn();
	} catch (_err) {
		console.error(`\n❌ Failed: ${name}`);
		process.exit(1);
	}
}

// ─── 1. Quality gate ───────────────────────────────────────────────
step("Quality: Lint", () => run("pnpm lint"));
step("Quality: Biome warning budget", () => {
	// Run biome check (budget enforced in CI; local run shows output)
	run("pnpm exec biome check .");
});
step("Quality: Typecheck", () => run("pnpm typecheck"));

// ─── 2a. Unit confidence ───────────────────────────────────────────
step("Unit confidence tests", () => {
	run("pnpm vitest run tests/unit/confidence --config vitest.unit.config.ts", {
		DATABASE_URL: "postgresql://test:test@localhost:5432/test",
	});
});

// ─── 2b. DB confidence ─────────────────────────────────────────────
if (!SKIP_DB) {
	step("DB confidence tests", () => {
		run(
			"pnpm vitest run tests/integration/golden-flow.test.ts tests/integration/failure-modes.test.ts tests/integration/concurrency.test.ts --config vitest.db.config.ts",
			{ DATABASE_URL: "postgresql://test:test@localhost:5432/test" },
		);
	});
} else {
	console.log("\n⏭ Skipping DB confidence tests (--skip-db)");
}

// ─── 2c. Regression gate ───────────────────────────────────────────
if (!SKIP_REGRESSION && !SKIP_DB) {
	step("Regression gate", () => {
		run("pnpm sdk:build");
		run("pnpm eval:regression-gate", {
			DATABASE_URL: "postgresql://test:test@localhost:5432/test",
		});
	});
} else if (SKIP_DB) {
	console.log("\n⏭ Skipping regression gate (--skip-db)");
}

// ─── 3. Test + Coverage ─────────────────────────────────────────────
step("Unit coverage", () => {
	run("pnpm test:unit:coverage", {
		DATABASE_URL: "postgresql://test:test@localhost:5432/test",
	});
});
if (!SKIP_DB) {
	step("DB coverage", () => {
		run("pnpm test:db:coverage", {
			DATABASE_URL: "postgresql://test:test@localhost:5432/test",
		});
	});
} else {
	console.log("\n⏭ Skipping DB coverage (--skip-db)");
}
step("DOM coverage", () => {
	run("pnpm test:dom:coverage", {
		DATABASE_URL: "postgresql://test:test@localhost:5432/test",
	});
});
if (!SKIP_DB) {
	step("Coverage audit", () => run("pnpm run audit:coverage"));
} else {
	console.log(
		"\n⏭ Skipping coverage audit (--skip-db: thresholds require DB-lane data)",
	);
}

// ─── 4. Build + E2E ────────────────────────────────────────────────
if (!SKIP_E2E) {
	step("Build", () => {
		run("pnpm build", {
			DATABASE_URL: "postgresql://test:test@localhost:5432/test",
			GITHUB_CLIENT_ID: "ci-placeholder",
			GITHUB_CLIENT_SECRET: "ci-placeholder",
			GOOGLE_CLIENT_ID: "ci-placeholder",
			GOOGLE_CLIENT_SECRET: "ci-placeholder",
			BETTER_AUTH_SECRET: "ci-placeholder-secret-at-least-32-chars!!",
			BETTER_AUTH_BASE_URL: "http://localhost:3000",
		});
	});
	step("E2E (Playwright)", () => {
		run("pnpm exec playwright install chromium");
		// Start server in background, run e2e, then kill. Use concurrently for cross-platform.
		run(
			'pnpm exec concurrently --kill-others --success first "pnpm start" "pnpm exec wait-on http://localhost:3000 -t 60000 && pnpm test:e2e"',
			{ PLAYWRIGHT_BASE_URL: "http://localhost:3000" },
		);
	});
} else {
	console.log("\n⏭ Skipping build + E2E (--skip-e2e)");
}

// ─── 5. SDK ───────────────────────────────────────────────────────
step("SDK build", () => run("pnpm sdk:build"));
step("SDK test", () => run("pnpm sdk:test"));

// ─── 6. Python SDK ─────────────────────────────────────────────────
step("Python SDK", () => {
	const pyDir = join(root, "src", "packages", "sdk-python");
	if (existsSync(pyDir)) {
		execSync("pip install -e .[dev] && pytest tests/ -v --tb=short", {
			cwd: pyDir,
			stdio: "inherit",
			env: process.env,
		});
	} else {
		console.log("  (skipped: src/packages/sdk-python not found)");
	}
});

// ─── 7. Audits ─────────────────────────────────────────────────────
if (!SKIP_AUDITS) {
	step("OpenAPI audit", () => run("pnpm run audit:openapi"));
	step("Demo assets audit", () => run("pnpm run audit:demo-assets"));
	step("Golden eval", () => run("pnpm run eval:golden"));
	step("Performance audit", () => run("pnpm run audit:performance"));
	step("Migration safety", () => run("pnpm run audit:migrations"));
	step("Index audit", () => run("pnpm run audit:indexes"));
	step("Dependency audit", () => run("pnpm audit --audit-level=high"));
	step("Retention audit", () => run("pnpm run audit:retention"));
} else {
	console.log("\n⏭ Skipping audits (--skip-audits)");
}

console.log("\n\n✅ Platform CI complete\n");
