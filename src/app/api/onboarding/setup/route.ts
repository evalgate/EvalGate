import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, organizationMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user already has an organization
    const existingMembership = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id))
      .limit(1);

    if (existingMembership.length > 0) {
      return NextResponse.json({ 
        message: 'User already has an organization',
        organizationId: existingMembership[0].organizationId
      }, { status: 200 });
    }

    // Create organization
    const now = new Date().toISOString();
    const organizationName = user.name ? `${user.name}'s Organization` : `${user.email}'s Organization`;
    
    const newOrganization = await db.insert(organizations)
      .values({
        name: organizationName,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const organizationId = newOrganization[0].id;

    // Create organization membership
    await db.insert(organizationMembers)
      .values({
        organizationId: organizationId,
        userId: user.id,
        role: 'owner',
        createdAt: now,
      });

    return NextResponse.json({ 
      message: 'Organization created successfully',
      organizationId: organizationId,
      organization: newOrganization[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Onboarding setup error:', error);
    return NextResponse.json({ 
      error: 'Failed to setup organization' 
    }, { status: 500 });
  }
}