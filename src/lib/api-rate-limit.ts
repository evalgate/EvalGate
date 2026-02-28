import crypto from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { rateLimited } from "@/lib/api/errors";
import { checkRateLimit } from "./rate-limit";

export async function withRateLimit(
	request: NextRequest,
	handler: (req: NextRequest) => Promise<NextResponse>,
	options?: {
		customIdentifier?: string;
		customTier?: "free" | "pro" | "enterprise" | "anonymous" | "mcp";
	},
) {
	try {
		// Get identifier (IP address or custom identifier)
		let identifier = options?.customIdentifier;
		if (!identifier) {
			const tier = options?.customTier || "anonymous";
			// For MCP tier, rate limit per API key when Bearer token present
			if (tier === "mcp") {
				const auth = request.headers.get("authorization");
				if (auth?.startsWith("Bearer ")) {
					identifier = `mcp:${crypto.createHash("sha256").update(auth).digest("hex").slice(0, 16)}`;
				}
			}
			if (!identifier) {
				identifier =
					request.headers.get("x-forwarded-for") ||
					request.headers.get("x-real-ip") ||
					"127.0.0.1";
			}
		}
		identifier = identifier || "anonymous";

		// Determine rate limit tier
		const tier = options?.customTier || "anonymous";

		// Check rate limit
		const { success, headers } = await checkRateLimit(identifier, tier);

		if (!success) {
			const res = rateLimited();
			Object.entries(headers).forEach(([key, value]) => {
				res.headers.set(key, value);
			});
			return res;
		}

		// Call the handler
		const response = await handler(request);

		// Add rate limit headers to response
		Object.entries(headers).forEach(([key, value]) => {
			response.headers.set(key, value);
		});

		return response;
	} catch (error) {
		Sentry.captureException(error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
