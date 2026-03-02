import { Autumn as autumn } from "autumn-js";
import { type NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { secureRoute } from "@/lib/api/secure-route";
import { logger } from "@/lib/logger";

export const POST = secureRoute(
	async (req, ctx) => {
		let body = {};
		try {
			body = await req.json();
		} catch {
			logger.warn("Failed to parse billing portal request body");
		}

		const { returnUrl } = body as { returnUrl?: string };

		try {
			const result = await autumn.customers.billingPortal(ctx.userId, {
				return_url: returnUrl || undefined,
			});

			if ("error" in result) {
				logger.error("Billing portal error", {
					error: result.error?.message || "Unknown error",
				});
				return internalError("Failed to generate billing portal URL");
			}

			const { url } = result;

			return NextResponse.json({ url }, { status: 200 });
		} catch (err: unknown) {
			logger.error("Billing portal error", { error: err });
			return internalError("Failed to generate billing portal URL");
		}
	},
	{ requireOrg: false },
);
