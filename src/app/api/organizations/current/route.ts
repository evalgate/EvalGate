import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizationMembers, organizations } from "@/db/schema";
import { internalError, notFound } from "@/lib/api/errors";
import { type AuthOnlyContext, secureRoute } from "@/lib/api/secure-route";

export const GET = secureRoute(
  async (_req: NextRequest, ctx: AuthOnlyContext) => {
    try {
      const memberships = await db
        .select({
          role: organizationMembers.role,
          organizationId: organizationMembers.organizationId,
          organizationName: organizations.name,
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
        .where(eq(organizationMembers.userId, ctx.userId))
        .limit(1);

      if (!memberships || memberships.length === 0) {
        return notFound("No organization found");
      }

      return NextResponse.json({
        organization: {
          id: memberships[0].organizationId,
          name: memberships[0].organizationName,
          role: memberships[0].role,
        },
      });
    } catch (_error: unknown) {
      return internalError();
    }
  },
  { requireOrg: false },
);
