import { Autumn as autumn } from "autumn-js";
import { NextResponse } from "next/server";
import { internalError, unauthorized } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session?.user) {
		return unauthorized("Unauthorized");
	}

	let body = {};
	try {
		body = await request.json();
	} catch {
		logger.warn("Failed to parse billing portal request body");
	}

	const { returnUrl } = body as { returnUrl?: string };

	try {
		const result = await autumn.customers.billingPortal(session.user.id, {
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
		logger.error("Billing portal error", err);
		return internalError("Failed to generate billing portal URL");
	}
}
