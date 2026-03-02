import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizationMembers, organizations, user } from "@/db/schema";
import { internalError } from "@/lib/api/errors";
import { secureRoute } from "@/lib/api/secure-route";
import { logger } from "@/lib/logger";

export const POST = secureRoute(
	async (_req, ctx) => {
		try {
			const existingMembership = await db
				.select()
				.from(organizationMembers)
				.where(eq(organizationMembers.userId, ctx.userId))
				.limit(1);

			if (existingMembership.length > 0) {
				return NextResponse.json(
					{
						message: "User already has an organization",
						organizationId: existingMembership[0].organizationId,
					},
					{ status: 200 },
				);
			}

			const now = new Date();
			const [userRow] = await db
				.select({ name: user.name, email: user.email })
				.from(user)
				.where(eq(user.id, ctx.userId))
				.limit(1);
			const organizationName = userRow?.name
				? `${userRow.name}'s Organization`
				: userRow?.email
					? `${userRow.email}'s Organization`
					: `User ${ctx.userId}'s Organization`;

			const newOrganization = await db
				.insert(organizations)
				.values({
					name: organizationName,
					createdAt: now,
					updatedAt: now,
				})
				.returning();

			const organizationId = newOrganization[0].id;

			await db.insert(organizationMembers).values({
				organizationId: organizationId,
				userId: ctx.userId,
				role: "owner",
				createdAt: now,
			});

			return NextResponse.json(
				{
					message: "Organization created successfully",
					organizationId: organizationId,
					organization: newOrganization[0],
				},
				{ status: 201 },
			);
		} catch (error: unknown) {
			logger.error("Onboarding setup error", { error });
			return internalError("Failed to setup organization");
		}
	},
	{ requireOrg: false },
);
