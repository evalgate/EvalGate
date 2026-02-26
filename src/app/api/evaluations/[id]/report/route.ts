import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reportCards } from "@/db/schema";
import { internalError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { reportCardsService } from "@/lib/services/report-cards.service";

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const evaluationId = parseInt(id, 10);
  const body = await req.json();

  try {
    const reportData = await reportCardsService.generateReportCard(
      evaluationId,
      ctx.organizationId,
    );

    const slug = randomUUID().slice(0, 10);
    const now = new Date();
    const [card] = await db
      .insert(reportCards)
      .values({
        evaluationId,
        evaluationRunId: body.evaluationRunId ?? 0,
        organizationId: ctx.organizationId,
        title: body.title || reportData.evaluationName,
        description: body.description || `Report card for ${reportData.evaluationName}`,
        slug,
        reportData: JSON.stringify(reportData),
        isPublic: body.isPublic ?? false,
        createdBy: ctx.userId,
        createdAt: now,
      })
      .returning();

    return NextResponse.json(card, { status: 201 });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});

export const GET = secureRoute(async (_req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const evaluationId = parseInt(id, 10);

  try {
    const reportData = await reportCardsService.generateReportCard(
      evaluationId,
      ctx.organizationId,
    );
    return NextResponse.json(reportData);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
