/**
 * Environment Variable Validation
 *
 * Validates all required and optional environment variables at startup
 * using Zod schemas. Fails fast with clear error messages if critical
 * variables are missing or malformed.
 */

import { z } from "zod";

const nonEmpty = z.string().min(1);

const serverSchema = z.object({
	// ── Database ──────────────────────────────────────────
	DATABASE_URL: nonEmpty.url().startsWith("postgres"),

	// ── Authentication (better-auth) ─────────────────────
	BETTER_AUTH_SECRET: nonEmpty,
	BETTER_AUTH_BASE_URL: nonEmpty.url().optional(),
	NEXT_PUBLIC_SITE_URL: nonEmpty.url().optional(),
	VERCEL_URL: z.string().optional(),

	// ── OAuth Providers (optional — app works without) ───
	GITHUB_CLIENT_ID: z.string().optional(),
	GITHUB_CLIENT_SECRET: z.string().optional(),
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),

	// ── Rate Limiting (Upstash Redis) ────────────────────
	UPSTASH_REDIS_REST_URL: nonEmpty.url().optional(),
	UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

	// ── Billing (Autumn.js) ──────────────────────────────
	AUTUMN_SECRET_KEY: z.string().optional(),
	AUTUMN_PRODUCTION_SECRET_KEY: z.string().optional(),

	// ── Encryption ───────────────────────────────────────
	PROVIDER_KEY_ENCRYPTION_KEY: z.string().min(32).optional(),

	// ── CORS ─────────────────────────────────────────────
	CORS_ALLOWED_ORIGINS: z.string().optional(),

	// ── Cron & Jobs ──────────────────────────────────────
	CRON_SECRET: z.string().optional(),
	MAX_JOBS_PER_RUN: z.coerce.number().int().positive().optional(),
	RUNNER_TIME_BUDGET_MS: z.coerce.number().int().positive().optional(),

	// ── LLM Providers ────────────────────────────────────
	OPENAI_API_KEY: z.string().optional(),
	ANTHROPIC_API_KEY: z.string().optional(),

	// ── Monitoring ───────────────────────────────────────
	SENTRY_DSN: z.string().optional(),
	NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

	// ── Runtime ──────────────────────────────────────────
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let _cachedEnv: ServerEnv | undefined;

/**
 * Check if we're in a build-time context where env vars may not be available.
 * Next.js sets this during static generation / build.
 */
function isBuildTime(): boolean {
	return (
		process.env.NEXT_PHASE === "phase-production-build" ||
		process.env.npm_lifecycle_event === "build"
	);
}

/**
 * Parse and cache the server environment. Throws a descriptive error on
 * the first call if any required variable is missing or malformed.
 *
 * During build time (e.g., Docker builds without env vars), returns safe
 * placeholder values to allow static generation to complete.
 */
export function env(): ServerEnv {
	if (_cachedEnv) return _cachedEnv;

	const result = serverSchema.safeParse(process.env);

	if (!result.success) {
		// During build time, return placeholder values so static generation works
		if (isBuildTime()) {
			_cachedEnv = {
				DATABASE_URL: "postgres://placeholder:placeholder@localhost:5432/placeholder",
				BETTER_AUTH_SECRET: "build-time-placeholder-secret-not-for-runtime",
				NODE_ENV: "production",
			} as ServerEnv;
			return _cachedEnv;
		}

		const formatted = result.error.issues
			.map((i) => `  • ${i.path.join(".")}: ${i.message}`)
			.join("\n");

		throw new Error(
			`❌ Invalid environment variables:\n${formatted}\n\nCheck .env.local against .env.example.`,
		);
	}

	_cachedEnv = result.data;
	return _cachedEnv;
}

/**
 * Reset the cached env (useful in tests).
 */
export function resetEnvCache(): void {
	_cachedEnv = undefined;
}
