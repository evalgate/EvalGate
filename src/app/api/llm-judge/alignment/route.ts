import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { evaluationRuns, humanAnnotations, llmJudgeResults } from "@/db/schema";
import { forbidden, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";

// Helper function to calculate alignment
function calculateAlignment(judgeScore: number | null, humanRating: number | null): number {
  if (judgeScore === null || humanRating === null) return 0;

  // Normalize scores to 0-1 range (assuming judge score is 0-100 and human rating is 1-5)
  const normalizedJudge = judgeScore / 100;
  const normalizedHuman = (humanRating - 1) / 4;

  // Calculate alignment as 1 - absolute difference
  return Math.max(0, 1 - Math.abs(normalizedJudge - normalizedHuman));
}

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const { searchParams } = new URL(req.url);
  const evaluationRunId = searchParams.get("evaluationRunId");

  if (!evaluationRunId) {
    return validationError("Evaluation run ID required");
  }

  const runId = parseInt(evaluationRunId, 10);

  // Verify the evaluationRun belongs to this org
  const run = await db
    .select({ organizationId: evaluationRuns.organizationId })
    .from(evaluationRuns)
    .where(eq(evaluationRuns.id, runId))
    .limit(1);

  if (run.length === 0 || run[0].organizationId !== ctx.organizationId) {
    return forbidden("Evaluation run not found or does not belong to your organization");
  }

  // Fetch LLM judge results for this evaluation run
  const judgeResults = await db
    .select()
    .from(llmJudgeResults)
    .where(eq(llmJudgeResults.evaluationRunId, runId));

  // Fetch human annotations for this evaluation run
  const annotations = await db
    .select()
    .from(humanAnnotations)
    .where(eq(humanAnnotations.evaluationRunId, runId));

  // Calculate alignment for matching test cases using the shared testCaseId
  const alignmentData = [];

  for (const judgeResult of judgeResults) {
    const humanAnnotation = annotations.find((h) => h.testCaseId === judgeResult.testCaseId);

    if (humanAnnotation) {
      const alignment = calculateAlignment(judgeResult.score, humanAnnotation.rating);

      alignmentData.push({
        testCaseId: judgeResult.testCaseId,
        judgeScore: judgeResult.score,
        humanRating: humanAnnotation.rating,
        alignment,
        judgeReasoning: judgeResult.reasoning,
        humanFeedback: humanAnnotation.feedback,
      });
    }
  }

  // Calculate overall alignment metrics
  const avgAlignment =
    alignmentData.length > 0
      ? alignmentData.reduce((sum, d) => sum + d.alignment, 0) / alignmentData.length
      : 0;

  const highAlignment = alignmentData.filter((d) => d.alignment >= 0.8).length;
  const lowAlignment = alignmentData.filter((d) => d.alignment < 0.5).length;

  return NextResponse.json({
    alignmentData,
    metrics: {
      averageAlignment: avgAlignment,
      totalComparisons: alignmentData.length,
      highAlignment,
      lowAlignment,
      alignmentRate: alignmentData.length > 0 ? highAlignment / alignmentData.length : 0,
    },
  });
});
