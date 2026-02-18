import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, organizationMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { secureRoute, type AuthOnlyContext } from '@/lib/api/secure-route';
import { notFound, internalError } from '@/lib/api/errors';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthOnlyContext) => {
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
      return notFound('No organization found');
    }

    return NextResponse.json({
      organization: {
        id: memberships[0].organizationId,
        name: memberships[0].organizationName,
        role: memberships[0].role,
      },
    });
  } catch (error: unknown) {
    return internalError();
  }
}, { requireOrg: false });
