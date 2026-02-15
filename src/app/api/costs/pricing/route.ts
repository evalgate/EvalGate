import { NextRequest, NextResponse } from 'next/server';
import { costService } from '@/lib/services/cost.service';
import { requireAdmin } from '@/lib/autumn-server';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

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
  return withRateLimit(request, async (req: NextRequest) => {
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

      return NextResponse.json({
        pricing: grouped,
        totalModels: pricing.length,
      }, {
        headers: {
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      });
    } catch (error: any) {
      logger.error('Error fetching pricing', {
        error: error.message,
        route: '/api/costs/pricing',
        method: 'GET',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}

/**
 * POST /api/costs/pricing - Update provider pricing (admin only)
 */
export async function POST(request: NextRequest) {
  return withRateLimit(request, async (req: NextRequest) => {
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
        return NextResponse.json({
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        }, { status: 400 });
      }

      const { provider, model, inputPricePerMillion, outputPricePerMillion } = validation.data;

      const pricing = await costService.updatePricing(
        provider,
        model,
        inputPricePerMillion,
        outputPricePerMillion
      );

      logger.info('Pricing updated', {
        provider,
        model,
        inputPricePerMillion,
        outputPricePerMillion,
      });

      return NextResponse.json(pricing, { status: 201 });
    } catch (error: any) {
      logger.error('Error updating pricing', {
        error: error.message,
        route: '/api/costs/pricing',
        method: 'POST',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
