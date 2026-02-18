import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { annotationTasks, evaluationRuns, evaluations, testCases } from "@/db/schema";
import { forbidden, notFound } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";

export const GET = secureRoute(async (_req: NextRequest, ctx: AuthContext, params) => {
  const taskId = parseInt(params.id, 10);

  // Fetch task with related data using joins
  const taskData = await db
    .select({
      task: annotationTasks,
      testCase: {
        name: testCases.name,
        input: testCases.input,
        expectedOutput: testCases.expectedOutput,
      },
      evaluationRun: {
        id: evaluationRuns.id,
      },
      evaluation: {
        name: evaluations.name,
        type: evaluations.type,
      },
    })
    .from(annotationTasks)
    .leftJoin(testCases, eq(annotationTasks.id, testCases.id))
    .leftJoin(evaluationRuns, eq(annotationTasks.id, evaluationRuns.id))
    .leftJoin(evaluations, eq(evaluationRuns.evaluationId, evaluations.id))
    .where(eq(annotationTasks.id, taskId))
    .limit(1);

  if (taskData.length === 0) {
    return notFound("Task not found");
  }

  // Verify org ownership
  if (taskData[0].task.organizationId !== ctx.organizationId) {
    return forbidden("Task does not belong to your organization");
  }

  // Format response to match Supabase structure
  const formattedTask = {
    ...taskData[0].task,
    test_cases: taskData[0].testCase,
    evaluation_runs: taskData[0].evaluationRun
      ? {
          ...taskData[0].evaluationRun,
          evaluations: taskData[0].evaluation,
        }
      : null,
  };

  return NextResponse.json({ task: formattedTask });
});
