/**
 * GET /api/evaluation-templates
 * Public endpoint returning evaluation templates from both template libraries.
 * Supports ?category= and ?limit= query params.
 * Used by WebMCP list_evaluation_templates tool.
 */

import { type NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { secureRoute } from "@/lib/api/secure-route";
import {
	COMPREHENSIVE_TEMPLATES,
	TEMPLATE_CATEGORIES,
} from "@/lib/evaluation-templates";
import { evaluationTemplates } from "@/lib/evaluation-templates-library";

interface SerializedTemplate {
	id: string;
	name: string;
	description: string;
	category: string;
	source: "featured" | "catalog";
	[key: string]: unknown;
}

export const GET = secureRoute(
	async (req: NextRequest, _ctx, _params) => {
		try {
			const { searchParams } = new URL(req.url);
			const category = searchParams.get("category");
			const limitParam = searchParams.get("limit");
			const limit = limitParam ? parseInt(limitParam, 10) : undefined;

			// Featured templates (from evaluation-templates-library.ts)
			const featured: SerializedTemplate[] = evaluationTemplates.map((t) => ({
				...t,
				source: "featured" as const,
				type: "unit_test" as const,
				complexity: t.complexity,
			}));

			// Catalog templates (from evaluation-templates.ts) with icon stripped
			const catalog: SerializedTemplate[] = COMPREHENSIVE_TEMPLATES.map((t) => {
				const { icon, ...rest } = t;
				return { ...rest, source: "catalog" as const };
			});

			// Combine
			let allTemplates: SerializedTemplate[] = [...featured, ...catalog];

			// Filter by category if provided
			if (category) {
				allTemplates = allTemplates.filter((t) => t.category === category);
			}

			// Apply limit
			const total = allTemplates.length;
			if (limit && limit > 0) {
				allTemplates = allTemplates.slice(0, limit);
			}

			return NextResponse.json({
				templates: allTemplates,
				total,
				categories: TEMPLATE_CATEGORIES.map((c) => ({
					id: c.id,
					name: c.name,
					description: c.description,
				})),
			});
		} catch (error: unknown) {
			return internalError(error instanceof Error ? error.message : undefined);
		}
	},
	{
		allowAnonymous: true,
		rateLimit: "anonymous",
		cacheControl: "public, max-age=60, stale-while-revalidate=300",
	},
);
