import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError, zodValidationError } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api-rate-limit";
import { requireAdmin } from "@/lib/autumn-server";
import { logger } from "@/lib/logger";
import { costService } from "@/lib/services/cost.service";

const updatePricingSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  inputPricePerMillion: z.string(),
  outputPricePerMillion: z.string(),
});

/**
 * GET /api/costs/pricing - Get all provider pricing
 */
export async function GET(request: NextRequest) {
  return withRateLimit(
    request,
    async (_req: NextRequest) => {
      try {
        const pricing = await costService.getAllPricing();

        // Group by provider
        const grouped: Record<string, any[]> = {};
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

        return NextResponse.json(
          {
            pricing: grouped,
            totalModels: pricing.length,
          },
          {
            headers: {
              "Cache-Control": "public, max-age=3600", // Cache for 1 hour
            },
          },
        );
      } catch (error: unknown) {
        logger.error("Error fetching pricing", {
          error: error instanceof Error ? error.message : String(error),
          route: "/api/costs/pricing",
          method: "GET",
        });
        return internalError();
      }
    },
    { customTier: "free" },
  );
}

/**
 * POST /api/costs/pricing - Update provider pricing (admin only)
 */
export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    async (req: NextRequest) => {
      try {
        // Admin-only: require owner or admin role (app-layer RLS)
        const authResult = await requireAdmin(request);
        if (!authResult.authenticated) {
          const data = await authResult.response.json();
          return NextResponse.json(data, { status: authResult.response.status });
        }

        const body = await req.json();

        // Validate request body
        const validation = updatePricingSchema.safeParse(body);
        if (!validation.success) {
          return zodValidationError(validation.error);
        }

        const { provider, model, inputPricePerMillion, outputPricePerMillion } = validation.data;

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
    { customTier: "free" },
  );
}
