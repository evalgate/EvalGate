import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { annotationTasks, evaluationRuns, humanAnnotations, testCases, user } from "@/db/schema";
import { validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const { searchParams } = new URL(req.url);
  const evaluationRunId = searchParams.get("evaluationRunId");
  const testCaseId = searchParams.get("testCaseId");

  // Build conditions array — always scope by org via evaluationRuns
  const conditions = [];
  if (evaluationRunId) {
    conditions.push(eq(humanAnnotations.evaluationRunId, parseInt(evaluationRunId, 10)));
  }
  if (testCaseId) {
    conditions.push(eq(humanAnnotations.testCaseId, parseInt(testCaseId, 10)));
  }
  // Org-scoping: join through evaluationRuns.organizationId
  conditions.push(eq(evaluationRuns.organizationId, ctx.organizationId));

  const query = db
    .select({
      id: humanAnnotations.id,
      evaluationRunId: humanAnnotations.evaluationRunId,
      testCaseId: humanAnnotations.testCaseId,
      annotatorId: humanAnnotations.annotatorId,
      rating: humanAnnotations.rating,
      feedback: humanAnnotations.feedback,
      labels: humanAnnotations.labels,
      metadata: humanAnnotations.metadata,
      createdAt: humanAnnotations.createdAt,
      annotator: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      testCase: {
        name: testCases.name,
      },
    })
    .from(humanAnnotations)
    .innerJoin(evaluationRuns, eq(humanAnnotations.evaluationRunId, evaluationRuns.id))
    .leftJoin(user, eq(humanAnnotations.annotatorId, user.id))
    .leftJoin(testCases, eq(humanAnnotations.testCaseId, testCases.id));

  const annotations = await query
    .where(and(...conditions))
    .orderBy(desc(humanAnnotations.createdAt));

  const formattedAnnotations = annotations.map((a) => ({
    ...a,
    users: a.annotator,
    test_cases: a.testCase,
    annotator: undefined,
    testCase: undefined,
  }));

  return NextResponse.json({ annotations: formattedAnnotations });
});

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const body = await req.json();
  const { evaluationRunId, testCaseId, rating, feedback, labels, metadata } = body;

  if (!evaluationRunId || !testCaseId) {
    return validationError("Missing required fields: evaluationRunId and testCaseId");
  }

  // Verify the evaluationRun belongs to this org
  const run = await db
    .select({ organizationId: evaluationRuns.organizationId })
    .from(evaluationRuns)
    .where(eq(evaluationRuns.id, evaluationRunId))
    .limit(1);

  if (run.length === 0 || run[0].organizationId !== ctx.organizationId) {
    return validationError("Evaluation run not found or does not belong to your organization");
  }

  const now = new Date();

  const newAnnotation = await db
    .insert(humanAnnotations)
    .values({
      evaluationRunId,
      testCaseId,
      annotatorId: ctx.userId,
      rating: rating || null,
      feedback: feedback || null,
      labels: labels || {},
      metadata: metadata || {},
      createdAt: now,
    })
    .returning();

  // Update task status to completed if it exists
  const existingTasks = await db
    .select()
    .from(annotationTasks)
    .where(eq(annotationTasks.id, testCaseId))
    .limit(1);

  if (existingTasks.length > 0) {
    await db
      .update(annotationTasks)
      .set({
        status: "completed",
        updatedAt: now,
      })
      .where(eq(annotationTasks.id, testCaseId));
  }

  return NextResponse.json({ annotation: newAnnotation[0] }, { status: 201 });
});
