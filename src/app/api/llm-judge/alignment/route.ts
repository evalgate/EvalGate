import { NextResponse, NextRequest } from "next/server"
import { db } from '@/db'
import { llmJudgeResults, humanAnnotations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

// Helper function to calculate alignment
function calculateAlignment(judgeScore: number | null, humanRating: number | null): number {
  if (judgeScore === null || humanRating === null) return 0
  
  // Normalize scores to 0-1 range (assuming judge score is 0-100 and human rating is 1-5)
  const normalizedJudge = judgeScore / 100
  const normalizedHuman = (humanRating - 1) / 4
  
  // Calculate alignment as 1 - absolute difference
  return Math.max(0, 1 - Math.abs(normalizedJudge - normalizedHuman))
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request)

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const evaluationRunId = searchParams.get("evaluationRunId")

    if (!evaluationRunId) {
      return NextResponse.json({ error: "Evaluation run ID required" }, { status: 400 })
    }

    const runId = parseInt(evaluationRunId)

    // Fetch LLM judge results for this evaluation run using the correct FK column
    const judgeResults = await db
      .select()
      .from(llmJudgeResults)
      .where(eq(llmJudgeResults.evaluationRunId, runId))

    // Fetch human annotations for this evaluation run
    const annotations = await db
      .select()
      .from(humanAnnotations)
      .where(eq(humanAnnotations.evaluationRunId, runId))

    // Calculate alignment for matching test cases using the shared testCaseId
    const alignmentData = []

    for (const judgeResult of judgeResults) {
      const humanAnnotation = annotations.find(
        (h) => h.testCaseId === judgeResult.testCaseId
      )

      if (humanAnnotation) {
        const alignment = calculateAlignment(judgeResult.score, humanAnnotation.rating)

        alignmentData.push({
          testCaseId: judgeResult.testCaseId,
          judgeScore: judgeResult.score,
          humanRating: humanAnnotation.rating,
          alignment,
          judgeReasoning: judgeResult.reasoning,
          humanFeedback: humanAnnotation.feedback,
        })
      }
    }

    // Calculate overall alignment metrics
    const avgAlignment =
      alignmentData.length > 0 ? alignmentData.reduce((sum, d) => sum + d.alignment, 0) / alignmentData.length : 0

    const highAlignment = alignmentData.filter((d) => d.alignment >= 0.8).length
    const lowAlignment = alignmentData.filter((d) => d.alignment < 0.5).length

    return NextResponse.json({
      alignmentData,
      metrics: {
        averageAlignment: avgAlignment,
        totalComparisons: alignmentData.length,
        highAlignment,
        lowAlignment,
        alignmentRate: alignmentData.length > 0 ? highAlignment / alignmentData.length : 0,
      },
    })
  } catch (error) {
    logger.error({ error, route: '/api/llm-judge/alignment' }, "Error calculating alignment")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
