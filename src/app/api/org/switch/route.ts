import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizationMembers } from "@/db/schema";
import { notFound, validationError } from "@/lib/api/errors";
import { type AuthOnlyContext, secureRoute } from "@/lib/api/secure-route";

/**
 * POST /api/org/switch
 *
 * Sets the `active_org` cookie to the given organization ID.
 * The caller must be a member of that organization.
 */
export const POST = secureRoute(
	async (req: NextRequest, ctx: AuthOnlyContext) => {
		const body = await req.json();
		const organizationId = body.organizationId;

		if (!organizationId || typeof organizationId !== "number") {
			return validationError("organizationId (number) is required");
		}

		// Verify the user is a member of the target org
		const [membership] = await db
			.select()
			.from(organizationMembers)
			.where(
				and(
					eq(organizationMembers.userId, ctx.userId),
					eq(organizationMembers.organizationId, organizationId),
				),
			)
			.limit(1);

		if (!membership) {
			return notFound("You are not a member of that organization");
		}

		const response = NextResponse.json({
			organizationId,
			role: membership.role,
			message: "Active organization switched",
		});

		// Set an HttpOnly cookie so subsequent requests carry the active org.
		// Max-age 1 year; SameSite=Lax is fine for same-origin API calls.
		(
			response as unknown as {
				cookies: {
					set: (
						name: string,
						value: string,
						opts: Record<string, unknown>,
					) => void;
				};
			}
		).cookies.set("active_org", String(organizationId), {
			httpOnly: true,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 365, // 1 year
			secure: process.env.NODE_ENV === "production",
		});

		return response;
	},
	{ requireOrg: false, routeRisk: "sensitive" },
);
