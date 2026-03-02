import { NextResponse } from "next/server";
import { z } from "zod";
import { internalError, zodValidationError } from "@/lib/api/errors";
import { secureRoute } from "@/lib/api/secure-route";
import { logger } from "@/lib/logger";
import { costService } from "@/lib/services/cost.service";

const updatePricingSchema = z.object({
	provider: z.string().min(1),
	model: z.string().min(1),
	inputPricePerMillion: z.string(),
	outputPricePerMillion: z.string(),
});

/**
 * GET /api/costs/pricing - Get all provider pricing (public)
 */
export const GET = secureRoute(
	async (_req) => {
		try {
			const pricing = await costService.getAllPricing();

			// Group by provider
			const grouped: Record<string, unknown[]> = {};
			for (const p of pricing) {
				if (!grouped[p.provider]) {
					grouped[p.provider] = [];
				}
				grouped[p.provider].push({
					model: p.model,
					inputPricePerMillion: parseFloat(p.inputPricePerMillion),
					outputPricePerMillion: parseFloat(p.outputPricePerMillion),
					effectiveDate: p.effectiveDate,
				});
			}

			return NextResponse.json({
				pricing: grouped,
				totalModels: pricing.length,
			});
		} catch (error: unknown) {
			logger.error("Error fetching pricing", {
				error: error instanceof Error ? error.message : String(error),
				route: "/api/costs/pricing",
				method: "GET",
			});
			return internalError();
		}
	},
	{
		allowAnonymous: true,
		cacheControl: "public, max-age=3600",
		rateLimit: "free",
	},
);

/**
 * POST /api/costs/pricing - Update provider pricing (admin only)
 */
export const POST = secureRoute(
	async (req, ctx) => {
		try {
			const body = await req.json();

			// Validate request body
			const validation = updatePricingSchema.safeParse(body);
			if (!validation.success) {
				return zodValidationError(validation.error);
			}

			const { provider, model, inputPricePerMillion, outputPricePerMillion } =
				validation.data;

			const pricing = await costService.updatePricing(
				provider,
				model,
				inputPricePerMillion,
				outputPricePerMillion,
			);

			logger.info("Pricing updated", {
				provider,
				model,
				inputPricePerMillion,
				outputPricePerMillion,
				userId: ctx.userId,
			});

			return NextResponse.json(pricing, { status: 201 });
		} catch (error: unknown) {
			logger.error("Error updating pricing", {
				error: error instanceof Error ? error.message : String(error),
				route: "/api/costs/pricing",
				method: "POST",
			});
			return internalError();
		}
	},
	{ minRole: "admin" },
);
