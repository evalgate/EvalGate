import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import {
	conflict,
	forbidden,
	internalError,
	validationError,
} from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parse";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { ALL_SCOPES, scopesForRole } from "@/lib/auth/scopes";
import { logger } from "@/lib/logger";
import { auditService } from "@/lib/services/audit.service";
import {
	createAPIKeyBodySchema,
	parsePaginationParams,
} from "@/lib/validation";

export const POST = secureRoute(
	async (req: NextRequest, ctx: AuthContext) => {
		const parsed = await parseBody(req, createAPIKeyBodySchema);
		if (!parsed.ok) return parsed.response;

		const { name, scopes, expiresAt } = parsed.data;
		const organizationId = ctx.organizationId;

		if (!organizationId) {
			return forbidden("No organization membership found");
		}

		try {
			const requestedScopes = scopes ?? [];
			if (requestedScopes.includes("*")) {
				return validationError("Wildcard scope '*' is not allowed");
			}
			const invalidScopes = requestedScopes.filter(
				(s) => !ALL_SCOPES.includes(s),
			);
			if (invalidScopes.length > 0) {
				return validationError(`Invalid scopes: ${invalidScopes.join(", ")}`);
			}

			const creatorScopes = new Set(scopesForRole(ctx.role));
			const excessScopes = requestedScopes.filter((s) => !creatorScopes.has(s));
			if (excessScopes.length > 0) {
				return forbidden(
					`Cannot grant scopes beyond your role: ${excessScopes.join(", ")}`,
				);
			}

			const randomBytes = crypto.randomBytes(24);
			const randomString = randomBytes
				.toString("base64")
				.replace(/\+/g, "")
				.replace(/\//g, "")
				.replace(/=/g, "")
				.substring(0, 32);

			const fullApiKey = `sk_test_${randomString}`;
			const keyHash = crypto
				.createHash("sha256")
				.update(fullApiKey)
				.digest("hex");
			const keyPrefix = fullApiKey.substring(0, 8);

			const newApiKey = await db
				.insert(apiKeys)
				.values({
					userId: ctx.userId,
					organizationId,
					keyHash,
					keyPrefix,
					name: name.trim(),
					scopes: scopes as import("@/db/types").ApiKeyScopes,
					expiresAt: expiresAt ? new Date(expiresAt) : null,
					lastUsedAt: null as unknown as Date,
					revokedAt: null,
					createdAt: new Date(),
				})
				.returning();

			if (newApiKey.length === 0) {
				return internalError("Failed to create API key");
			}

			await auditService.log({
				organizationId,
				userId: ctx.userId,
				action: "api_key_created",
				resourceType: "api_key",
				resourceId: String(newApiKey[0].id),
				metadata: {
					apiKeyId: newApiKey[0].id,
					name: newApiKey[0].name,
					keyPrefix: newApiKey[0].keyPrefix,
				},
			});

			return NextResponse.json(
				{
					apiKey: fullApiKey,
					id: newApiKey[0].id,
					name: newApiKey[0].name,
					keyPrefix: newApiKey[0].keyPrefix,
				},
				{ status: 201 },
			);
		} catch (error: unknown) {
			if (
				error instanceof Error &&
				(error.message.includes("UNIQUE constraint failed") ||
					(error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE")
			) {
				return conflict("API key prefix collision — please retry");
			}
			logger.error(
				{ error, route: "/api/developer/api-keys", method: "POST" },
				"Error creating API key",
			);
			return internalError();
		}
	},
	{ minRole: "admin", routeRisk: "sensitive" },
);

export const GET = secureRoute(
	async (req: NextRequest, ctx: AuthContext) => {
		try {
			const { searchParams } = new URL(req.url);

			const { limit, offset } = parsePaginationParams(searchParams);

			const whereConditions = [
				eq(apiKeys.userId, ctx.userId),
				eq(apiKeys.organizationId, ctx.organizationId),
			];

			const results = await db
				.select({
					id: apiKeys.id,
					userId: apiKeys.userId,
					organizationId: apiKeys.organizationId,
					keyPrefix: apiKeys.keyPrefix,
					name: apiKeys.name,
					scopes: apiKeys.scopes,
					lastUsedAt: apiKeys.lastUsedAt,
					expiresAt: apiKeys.expiresAt,
					revokedAt: apiKeys.revokedAt,
					createdAt: apiKeys.createdAt,
				})
				.from(apiKeys)
				.where(and(...whereConditions))
				.orderBy(desc(apiKeys.createdAt))
				.limit(limit)
				.offset(offset);

			return NextResponse.json(results, { status: 200 });
		} catch (error: unknown) {
			logger.error(
				{ error, route: "/api/developer/api-keys", method: "GET" },
				"Error fetching API keys",
			);
			return internalError();
		}
	},
	{ rateLimit: "free" },
);
