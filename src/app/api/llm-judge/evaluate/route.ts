import { type NextRequest, NextResponse } from "next/server";
import { internalError, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { logger } from "@/lib/logger";
import { llmJudgeService } from "@/lib/services/llm-judge.service";

export const POST = secureRoute(
  async (req: NextRequest, ctx: AuthContext) => {
    try {
      const body = await req.json();
      const { configId, input, output, context, expectedOutput, metadata } = body;

      if (!configId || !input || !output) {
        return validationError("configId, input, and output are required");
      }

      const judgement = await llmJudgeService.evaluate(ctx.organizationId, {
        configId,
        input,
        output,
        context,
        expectedOutput,
        metadata: {
          ...metadata,
          evaluatedBy: ctx.userId,
        },
      });

      return NextResponse.json(
        {
          result: {
            score: judgement.score,
            reasoning: judgement.reasoning,
            passed: judgement.passed,
            details: judgement.details,
          },
        },
        { status: 201 },
      );
    } catch (error: unknown) {
      logger.error(
        { error, route: "/api/llm-judge/evaluate", method: "POST" },
        "Error evaluating with LLM judge",
      );
      return internalError();
    }
  },
  { rateLimit: "free" },
);
