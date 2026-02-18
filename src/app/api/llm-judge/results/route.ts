import { and, desc, eq, gte, lte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { llmJudgeConfigs, llmJudgeResults } from "@/db/schema";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";

/**
 * GET /api/llm-judge/results - Fetch LLM judge results scoped to the user's organization
 */
export const GET = secureRoute(
  async (request: NextRequest, ctx: AuthContext) => {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const configId = searchParams.get("configId");
    const minScore = searchParams.get("minScore");
    const maxScore = searchParams.get("maxScore");

    // Build filter conditions — always scope to organization via llmJudgeConfigs
    const conditions = [eq(llmJudgeConfigs.organizationId, ctx.organizationId)];

    if (configId) {
      conditions.push(eq(llmJudgeResults.configId, parseInt(configId, 10)));
    }

    if (minScore) {
      conditions.push(gte(llmJudgeResults.score, parseInt(minScore, 10)));
    }

    if (maxScore) {
      conditions.push(lte(llmJudgeResults.score, parseInt(maxScore, 10)));
    }

    // Join through llmJudgeConfigs to enforce org-scoping
    const results = await db
      .select({
        id: llmJudgeResults.id,
        configId: llmJudgeResults.configId,
        evaluationRunId: llmJudgeResults.evaluationRunId,
        testCaseId: llmJudgeResults.testCaseId,
        input: llmJudgeResults.input,
        output: llmJudgeResults.output,
        score: llmJudgeResults.score,
        reasoning: llmJudgeResults.reasoning,
        metadata: llmJudgeResults.metadata,
        createdAt: llmJudgeResults.createdAt,
      })
      .from(llmJudgeResults)
      .innerJoin(llmJudgeConfigs, eq(llmJudgeResults.configId, llmJudgeConfigs.id))
      .where(and(...conditions))
      .orderBy(desc(llmJudgeResults.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results);
  },
  { rateLimit: "free" },
);
